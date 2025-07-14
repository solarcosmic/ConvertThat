const { Client, Events, GatewayIntentBits, ContextMenuCommandBuilder, ApplicationCommandType, REST, Routes, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const wait = require("node:timers/promises").setTimeout;
const sharp = require("sharp");
const axios = require("axios");
const getColours = require("get-image-colors");
const { StringSelectMenuBuilder } = require("@discordjs/builders");
const { StringSelectMenuOptionBuilder } = require("@discordjs/builders");
const dotenv = require("dotenv").config();
const token = process.env.CLIENT_TOKEN;
const rest = new REST({version: "10"}).setToken(token);
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // TODO: remove

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages]});
const contextData = new ContextMenuCommandBuilder()
    .setName("Convert Image")
    .setType(ApplicationCommandType.Message)

client.on("ready", async () => {
    console.log("Running: " + client.user.tag);
    await rest.put(
        Routes.applicationCommands(clientId, guildId),
        {body: [contextData.toJSON()]}
    );
})
client.on("messageCreate", message => {
    console.log(message.content);
})

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

const buttons = new ButtonBuilder()
    .setLabel("Get Direct Link")
    .setCustomId("get_direct_link_img_convert")
    .setStyle(ButtonStyle.Secondary);

const row = new ActionRowBuilder()
    .addComponents(format_sel);

const row_btn = new ActionRowBuilder()
    .addComponents(buttons);

var toConvert = null;
const convertMap = new Map();
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isMessageContextMenuCommand()) return;
    const attach = interaction.targetMessage.attachments.first();
    convertMap.set(interaction.user.id, attach);
    // continue
    if (!attach) {
        await interaction.reply({content: `Image not found! Are you sure this is attached correctly?`, flags: MessageFlags.Ephemeral});
        return;
    }
    if (!attach.contentType.includes("image")) {
        await interaction.reply({content: `The attachment provided seems to not be a supported image! Only PNG and JPEG file types are supported.`, flags: MessageFlags.Ephemeral});
        return;
    }
    await interaction.reply({content: `What would you like to convert this image to (${attach.name})?`, components: [row], flags: MessageFlags.Ephemeral});
    toConvert = attach;
})

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    const item = convertMap.get(interaction.user.id);
    if (!item) {
        interaction.update({content: "Session expired! Please retry.", components: []});
        return;
    }
    await interaction.update({content: "Converting your image to your selected format. This may take a while.", components: []});
    const format = interaction.values[0];
    const img = await convertImage(item.url, format);
    const fileName = item.name.substring(0, item.name.lastIndexOf("."));
    const combined = fileName + "." + format.slice(6);
    const attach = new AttachmentBuilder(img, {name: combined});
    var mainColour = "#00b0f4";
    try {
        const colours = await getColours(img, format);
        if (colours && colours.length > 0) {
            mainColour = colours[0].hex();
        }
    } catch (e) {
        console.log("Error while gathering colours: " + e);
    }
    await interaction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(attach.name)
                .addFields(
                    {
                        name: "Conversion",
                        value: `${item.contentType.slice(6).toUpperCase()} -> ${format.slice(6).toUpperCase()}`,
                        inline: true
                    }
                )
                .setImage("attachment://" + combined)
                .setColor(mainColour)
                .setFooter({text: "ConvertThat"})
                .setTimestamp()
        ],
        components: [row_btn],
        files: [attach],
        ephemeral: true
    });
})

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton) return;
    if (interaction.customId == "get_direct_link_img_convert") {
        // TODO: implement
    }
})

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

client.login(token);