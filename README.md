# ConvertThat
A Discord bot that lets you convert and compress images to different formats within Discord.
ConvertThat only supports PNG, JPG, and WebP at the moment, as Discord renders those formats.
## How does ConvertThat work?
ConvertThat uses Discord.js for the Discord bot framework, and the Node.js module "Sharp" behind the scenes to convert and compress images.

It uses Axios to grab the attachment image link, then uses Sharp to convert it and export it as an image buffer. Sharp is also used to compress images to a certain threshold.

## How can I run it?
Simple!
1. Clone the GitHub repository or download a source code archive from the releases
2. Open a terminal in that location and run `npm i` to install required dependencies
3. Rename `.env.example` to `.env` and enter in your Bot Token & Client ID
4. Run `node bot.js`.
5. Done!