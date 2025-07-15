# ConvertThat
A Discord bot that lets you convert and compress images to different formats within Discord.
ConvertThat only supports `PNG`, `JPG`/`JPEG`, and `WebP` at the moment, as Discord renders those formats.

## How does ConvertThat work?
ConvertThat uses Discord.js for the Discord bot framework, and the Node.js module "Sharp" behind the scenes to convert and compress images.

It uses axios to grab the attachment image link, then uses Sharp to convert it and export it as an image buffer. Sharp is also used to compress images to a certain quality, best shown with JPEG images.

## How can I run it?
Simple!
1. Clone the GitHub repository or download a source code archive from the releases
2. Open a terminal in that location and run `npm i` to install required dependencies
3. Rename `.env.example` to `.env` and enter in your Bot Token & Client ID
4. Run `node bot.js`.
5. Done!

## AI Disclosure (GPT-4o, Gemini)
AI was used in the making of this Discord bot. Here is what it was used for:
- Various aspects I couldn't quite understand
- Issues arising in code that I didn't know how to fix
- (some) code refactoring (possibly)

This code is licensed under MIT.