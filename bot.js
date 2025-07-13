const { Client, Events, GatewayIntentBits, ContextMenuCommandBuilder, ApplicationCommandType, REST, Routes, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const wait = require("node:timers/promises").setTimeout;
const sharp = require("sharp");
const axios = require("axios");
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

const pngButton = new ButtonBuilder()
    .setCustomId("png_select")
    .setLabel(".png")
    .setStyle(ButtonStyle.Primary);

const jpgButton = new ButtonBuilder()
    .setCustomId("jpg_select")
    .setLabel(".jpg")
    .setStyle(ButtonStyle.Secondary);

const row = new ActionRowBuilder()
    .addComponents(pngButton, jpgButton);

var toConvert = null;
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isMessageContextMenuCommand()) return;
    const message = interaction.targetMessage.attachments.first();
    //console.log(message);
    if (!message) {
        await interaction.reply({content: `Image not found! Are you sure this is attached correctly?`, flags: MessageFlags.Ephemeral});
        return;
    }
    if (message.contentType != "image/jpeg") {
        await interaction.reply({content: `The attachment provided seems to not be a supported image! Only PNG and JPEG file types are supported.`, flags: MessageFlags.Ephemeral});
        return;
    }
    await interaction.reply({content: `What would you like to convert this image to (${message.name})?`, components: [row], flags: MessageFlags.Ephemeral});
    toConvert = message;
})
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    await interaction.update({content: "Converting your image to your selected format. This may take a while.", components: []});
    //await wait(5_000);
    if (toConvert) {
        const img = await convertImage(toConvert.url, "image/png");
        const attach = new AttachmentBuilder(img, {name: "converted.png"})
        console.log(attach);
        // https://embed.dan.onl/
        /*const embed = new EmbedBuilder()
        .setTitle(toConvert.name)
        .setImage("Image")
        .setColor("#00b0f4")
        .setFooter({
            text: "ConvertThat",
        })
        .setTimestamp();*/

        //await message.reply({ embeds: [embed] });
        const sent = await interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(attach.name)
                    .addFields(
                        {
                            name: "Conversion",
                            value: "JPG -> PNG",
                            inline: true
                        }
                    )
                    .setImage("attachment://converted.png")
                    .setColor("#00b0f4")
                    .setFooter({text: "ConvertThat"})
                    .setTimestamp()
            ],
            files: [attach],
            ephemeral: true
        });
        //await interaction.followUp({content: "Here is your converted image.", files: [{attachment: img, name: "converted.png"}], flags: MessageFlags.Ephemeral});
    }
    /*
    if (interaction.customId == "png_select") {
        await interaction.update({content: "Converting your image to your selected format. This may take a while.", components: []});
    } else if (interaction.customId == "jpg_select") {
        await interaction.update({content: "You chose JPG!", components: []});
    } */
})

async function convertImage(url, format) {
    var resp;
    var buffer;
    try {
        resp = await axios.get(url, {responseType: "arraybuffer"});
        if (resp) buffer = Buffer.from(resp.data);
        if (format == "image/png") {
            const sharpImg = await sharp(buffer).png().toBuffer();
            return sharpImg;
        }
    } catch (e) {
        console.log("Conversion error: " + e);
    }
}

client.login(token);