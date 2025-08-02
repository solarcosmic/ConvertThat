/*
 * Copyright (c) 2025 solarcosmic.
 * This project is licensed under the MIT license.
 * To view the license, see <https://opensource.org/licenses/MIT>.
*/
/*
 * ConvertThat - A Discord bot that lets you convert and compress images to different formats within Discord.
 * It only supports PNG, JPG, and WebP at the moment, as Discord renders those formats.
 * This is (basically) one of my first attempts at writing a Discord bot in Node.js/Discord.js.
*/
const {
    Client,
    Events,
    GatewayIntentBits,
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    REST,
    Routes,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
    EmbedBuilder,
    AttachmentBuilder,
    ComponentType,
    TextInputStyle,
    PresenceUpdateStatus
} = require("discord.js");
const {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    ModalBuilder
} = require("@discordjs/builders");

const sharp = require("sharp");
const axios = require("axios");
const getColours = require("get-image-colors");
require("dotenv").config();
const token = process.env.CLIENT_TOKEN;
const rest = new REST({version: "10"}).setToken(token);
const clientId = process.env.CLIENT_ID;

/*
 * Set up of the context menus.
*/
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages]});
const compressImgContext = new ContextMenuCommandBuilder()
    .setName("Compress Image")
    .setType(ApplicationCommandType.Message)
const convertImgContext = new ContextMenuCommandBuilder()
    .setName("Convert Image")
    .setType(ApplicationCommandType.Message)
client.on("ready", async () => {
    console.log("Running: " + client.user.tag);
    await rest.put(
        Routes.applicationCommands(clientId),
        {body: [convertImgContext.toJSON(), compressImgContext.toJSON()]}
    );
    client.user.setStatus(PresenceUpdateStatus.Idle);
});

/*
 * The format selection dropdown that shows when you click "Convert Image".
*/
const format_sel = new StringSelectMenuBuilder()
    .setCustomId("format_sel")
    .setPlaceholder("Choose a format...")
    .addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel("PNG (.png)")
            .setDescription("Portable Network Graphics")
            .setValue("image/png"),
        new StringSelectMenuOptionBuilder()
            .setLabel("JPG/JPEG (.jpg)")
            .setDescription("Joint Photographic Experts Group Image")
            .setValue("image/jpeg"),
        new StringSelectMenuOptionBuilder()
            .setLabel("WebP (.webp)")
            .setDescription("Web Picture Format")
            .setValue("image/webp")
    )

/*
 * Buttons & Modal for converting & compressing
*/
const buttons = new ButtonBuilder()
    .setLabel("Get Direct Link")
    .setCustomId("get_direct_link_img_convert")
    .setStyle(ButtonStyle.Secondary);
const compress = new ButtonBuilder()
    .setLabel("Compress Image")
    .setCustomId("compress_img_convert")
    .setStyle(ButtonStyle.Secondary);
const modal = new ModalBuilder()
    .setCustomId("compress_image_modal")
    .setTitle("Image Quality (Compress)");
const amountInput = new TextInputBuilder()
    .setCustomId("compress_threshold_text")
    .setLabel("Image Quality (1-100)")
    .setStyle(TextInputStyle.Short);

/*
 * Adding components to the ActionRowBuilders
*/
const row = new ActionRowBuilder().addComponents(format_sel);

const modalBuild = new ActionRowBuilder().addComponents(amountInput);
modal.addComponents(modalBuild);

const row_btn = new ActionRowBuilder().addComponents(buttons, compress);

const convertMap = new Map(); // stores converted things

/*
 * Main interactions (where everything happens).
 * This handles the context menu functions, modals, and compressing/conversion, using Sharp's logic.
 * It's a bit of a mess, but it does the job and I would say is a solid attempt for one of my first bots written in Discord.js.
*/
client.on(Events.InteractionCreate, async interaction => {
    try {
    if (interaction.isMessageContextMenuCommand()) {
        const attach = interaction.targetMessage.attachments.first();
        if (!attach) {
            await interaction.editReply({content: `Image not found! Are you sure this is attached correctly?`, ephemeral: true});
            return;
        }
        if (!attach.contentType.includes("image")) {
            await interaction.editReply({content: `The attachment provided seems to not be a supported image! Only PNG, JPEG, and WebP file types are supported.`, ephemeral: true});
            return;
        }
        if (interaction.commandName == "Convert Image") {
            await interaction.deferReply({ephemeral: true});
            convertMap.set(interaction.user.id, attach);
            await interaction.editReply({content: `What would you like to convert this image to (${attach.name})? \n\n-# By using this tool, you agree that you own the rights to that image and that you follow Discord Terms. ConvertThat and its contributors are not responsible for the image you submit. Converted images get uploaded to Discord.`, components: [row], ephemeral: true});
        } else if (interaction.commandName == "Compress Image") {
            convertMap.set(interaction.user.id, attach);
            await interaction.showModal(modal);
        }
        return;
    }
    if (interaction.isModalSubmit()) {
        if (interaction.customId == "compress_image_modal") {
            const level = interaction.fields.getTextInputValue("compress_threshold_text");
            const numlevel = Number(level);
            if (numlevel) {
                if (numlevel > 100) {
                    await interaction.reply({content: `The number you have chosen is too high!`, ephemeral: true});
                    return;
                }
                const newlevel = Math.floor(numlevel);
                var url;
                var title;
                var content_type;
                const embed = interaction.message?.embeds?.[0]; // neat trick
                if (embed && embed.image?.url && embed.title) {
                    url = embed.image.url;
                    title = embed.title;
                    content_type = "image/" + title.split(".").pop();
                } else {
                    const attach = convertMap.get(interaction.user.id);
                    if (!attach) {
                        await interaction.reply({content: "Uh oh! Session expired... please retry.", ephemeral: true});
                        return;
                    }
                    url = attach.url;
                    title = attach.name;
                    content_type = attach.contentType;
                }
                //const content_type = embed.data.image.content_type;
                const img = await compressImage(url, content_type, newlevel);
                //const title = embed.data.title; // how we get the file name and extension
                const format = content_type.slice(6);
                const attach_thing = new AttachmentBuilder(img, {name: title}); // build the attachment
                var mainColour = null;
                // a try block that attempts to get the (first) main accent colour of an image. does not work on webp.
                try {
                    const colours = await getColours(img, content_type); // npm: get-image-colours
                    if (colours && colours.length > 0) {
                        mainColour = colours[0].hex(); // get the hex colour of the first colour found
                    }
                } catch (e) {
                    console.log("Error while gathering colours: " + e);
                }
                const emb = new EmbedBuilder()
                    .setTitle(title)
                    .addFields(
                        {
                            name: "Compression",
                            value: `Quality: ${newlevel}%`,
                            inline: true
                        }
                    )
                    .setImage("attachment://" + title)
                    .setFooter({text: "ConvertThat"})
                    .setTimestamp();
                if (mainColour) emb.setColor(mainColour);
                if (format == "image/webp") emb.setDescription("Note: WebP accent colours are not supported. Resorting to default.");
                const sent = await interaction.reply({
                    content: "",
                    embeds: [emb],
                    components: [row_btn],
                    files: [attach_thing],
                    ephemeral: true,
                    fetchReply: true
                });
                console.log("Compressed image named " + title + ` to quality ${newlevel}%`);
                attachCollector(sent);
            } else {
                await interaction.reply({content: `Please enter a valid number.`, ephemeral: true});
                return;
            }
        }
        return;
    }
    if (!interaction.isStringSelectMenu()) return;
    const item = convertMap.get(interaction.user.id);
    if (!item) {
        interaction.update({content: "Session expired! Please retry.", components: []});
        return;
    }
    await interaction.update({content: "Converting your image to your selected format. This may take a while.", components: []});
    // logic to gather formats & file names and get the result
    const format = interaction.values[0]; // format to convert to
    const img = await convertImage(item.url, format); // calls convertimage function
    const fileName = item.name.substring(0, item.name.lastIndexOf(".")); // get the file name without the extension
    const combined = fileName + "." + format.slice(6); // combine the filename, followed by the file extension (taken from content type)
    const attach = new AttachmentBuilder(img, {name: combined}); // build the attachment
    var mainColour = null;
    // a try block that attempts to get the (first) main accent colour of an image. does not work on webp.
    try {
        const colours = await getColours(img, format); // npm: get-image-colours
        if (colours && colours.length > 0) {
            mainColour = colours[0].hex(); // get the hex colour of the first colour found
        }
    } catch (e) {
        console.log("Error while gathering colours: " + e);
    }
    const emb = new EmbedBuilder()
        .setTitle(attach.name)
        .addFields(
            {
                name: "Conversion",
                value: `${item.contentType.slice(6).toUpperCase()} -> ${format.slice(6).toUpperCase()}`,
                inline: true
            }
        )
        .setImage("attachment://" + combined)
        .setFooter({text: "ConvertThat"})
        .setTimestamp()
    if (mainColour) emb.setColor(mainColour);
    if (format == "image/webp") emb.setDescription("Note: WebP accent colours are not supported. Resorting to default."); // limitation of npm: get-image-colours
    const sent = await interaction.editReply({
        content: "",
        embeds: [emb],
        components: [row_btn],
        files: [attach],
        ephemeral: true,
        fetchReply: true
    });
    console.log("Converted image named " + combined + ` (${item.contentType.slice(6).toUpperCase()} -> ${format.slice(6).toUpperCase()})`);
    attachCollector(sent);
    } catch (e) {
        console.log("Error: " + e);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({content: `Error: ${e.message}`, ephemeral: true});
        } else {
            await interaction.reply({content: `Internal error. Please report this to developers. ${e}`, ephemeral: true});
        }
    }
})

/*
 * Function to convert an image from a URL to a specified format.
 * Uses axios to fetch and Sharp to convert the image buffer from the URL, then return it into the converted image buffer.
*/
async function convertImage(url, format) {
    var resp;
    var buffer;
    try {
        resp = await axios.get(url, {responseType: "arraybuffer"});
        if (resp) buffer = Buffer.from(resp.data);
        return await sharp(buffer).toFormat(format.slice(6)).toBuffer();
    } catch (e) {
        console.log("Conversion error: " + e);
    }
}

/*
 * Function to compress an image from a URL to a certain quality.
 * Uses axios to fetch and Sharp to compress the image buffer from the URL, then return it into the new image buffer.
*/
async function compressImage(url, format, threshold) {
    var resp;
    var buffer;
    try {
        resp = await axios.get(url, {responseType: "arraybuffer"});
        if (resp) buffer = Buffer.from(resp.data);
        return await sharp(buffer).toFormat(format.slice(6), {quality: threshold}).toBuffer();
    } catch (e) {
        console.log("Conversion error: " + e);
    }
}

/*
 * A function to attach collectors.
 * This is used to get button clicks primarily.
*/
function attachCollector(sent) {
    const collect = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000
    });
    collect.on("collect", async btninter => {
        if (!btninter.isButton()) return;
        if (btninter.customId == "get_direct_link_img_convert") { // direct link logic
            await btninter.deferReply({ephemeral: true});
            const n_embed = sent.embeds[0];
            if (!n_embed || !n_embed.image || !n_embed.image.url) {
                await btninter.followUp({content: "Couldn't find the attachment image!", ephemeral: true});
                return;
            }
            await btninter.followUp({content: `Here's the direct link! \n[Direct Link - ${n_embed.title}](<${n_embed.image.url}>)` + "\n\nHowever, if you want to copy the link directly: ```" + `${n_embed.image.url}` + "```", ephemeral: true});
        } else if (btninter.customId == "compress_img_convert") {
            await btninter.showModal(modal);
        }
    })
}

client.login(token);