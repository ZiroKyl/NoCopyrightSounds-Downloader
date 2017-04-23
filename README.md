# NoCopyrightSounds Downloader
Little script that helps

* download and catalog some set of your favorite [NCS](https://www.youtube.com/user/NoCopyrightSounds) songs
* auto add proper NCS [text](http://nocopyrightsounds.co.uk/user-license/) (for use in YouTube and Twitch) to ID3 comment tag

![No Copyright Sounds logo](https://upload.wikimedia.org/wikipedia/commons/6/6e/No_Copyright_Sounds_logo.jpg "NCS logo from Wikimedia")

## Usage
*nix:
```shell
cat NoCopyrightSounds.txt | NoCopyrightSounds.js > out
```
Windows:
```cmd
type NoCopyrightSounds.txt | node.exe NoCopyrightSounds.js > out.txt
```
`NoCopyrightSounds.txt` must contain one `full YouTube URL` and `user-comment` (optionaly) per _line_.

_Line_ format:
```
<full YouTube URL> (<user-comment>)
```

### Example
```
I love this song so much https://www.youtube.com/watch?v=vpvytpRa_tQ&index=12&list=PLRBp0Fe2GpgnIh0AiYKh7o7HnYAej-5ph I can't stop (and pause) listening (cool)
```
This _line_ produce `./music/Jensation - Joystick.mp3` file and set ID3 comment tag to:
```
(cool)
Song: Jensation - Joystick [NCS Release]
Music provided by NoCopyrightSounds.
Video Link: https://youtu.be/vpvytpRa_tQ
```

### Errors
If you see errors in `out` file then just use it as input file:
```shell
cat out | NoCopyrightSounds.js > out0
```
You can also use pipe-man style (-:
```shell
cat out0 | NoCopyrightSounds.js | NoCopyrightSounds.js | NoCopyrightSounds.js | NoCopyrightSounds.js | NoCopyrightSounds.js > out1
```
**Remember**, this script not universal. It support only few original songs sources (see `downloadFrom` object).

## Install :package:
You will need:

* [Node.js](https://nodejs.org/en/download/)
* ~~ffmpeg 3.2~~ (mp3 ID3 COMM tag problem, see comment in `NoCopyrightSounds.js`)
* [ID3](https://github.com/squell/id3/releases) (place together with `NoCopyrightSounds.js`)

**For Windows**: just [download](https://github.com/ZiroKyl/NoCopyrightSounds-Downloader/releases) (includes ID3), unpack and configure.

__For *nix__: clone or download repo, configure `NoCopyrightSounds.js` and run:
```shell
npm install --production
```
OR [download](https://github.com/ZiroKyl/NoCopyrightSounds-Downloader/releases) Windows version ;)

### Configure NoCopyrightSounds.js :wrench:
Find all `//CONFIGURE:` comments in file and _follow the White Rabbit_ :rabbit2:

See also `//NOTE:` comments.
