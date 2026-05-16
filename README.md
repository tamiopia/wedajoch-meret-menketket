# Earthquake Terminal Sound 🌋🔊

Turn your terminal failures into an experience! This extension plays an "earthquake" alert sound whenever a command fails with a non-zero exit code.

## 🚀 Features

- **VS Code Integrated**: Works seamlessly inside the VS Code integrated terminal.
- **System-Wide Support**: Can be installed to your native Zsh shell to work in any terminal (iTerm2, Apple Terminal, etc.).
- **Automatic Detection**: Uses Shell Integration to accurately detect failed commands.
- **Customizable**: Toggle it on/off or provide your own custom sound file.

## 🛠 Installation

### For VS Code
1. Install the extension from the Marketplace.
2. Ensure **Terminal Shell Integration** is enabled in your VS Code settings (it's usually on by default).

### For the Whole System (Zsh)
1. Open the **Command Palette** (`Cmd + Shift + P`).
2. Run **`Earthquake Terminal Sound: Install to System Shell (Zsh)`**.
3. Restart your terminal or run `source ~/.zshrc`.

## ⚙️ Configuration

Access these settings via **File > Preferences > Settings** and search for "Earthquake":

- `terminal-error-sound.enabled`: Quickly toggle the sound on or off.
- `terminal-error-sound.soundPath`: Provide an absolute path to your own `.mp3` or `.wav` file if you want to change the sound. Leave empty to use the bundled earthquake sound.

## 📖 User Manual

### How it works
The extension listens for the "end of execution" signal from your shell. if the command you just ran returns an error (anything other than `0`), the earthquake sound will play.

### Commands
- **Test Sound**: Run this from the Command Palette to verify your volume and sound settings.
- **Toggle**: Quickly enable or disable the sound without opening settings.
- **Install to System Shell**: Sets up a permanent hook in your `~/.zshrc` so you get the sound even when VS Code is closed.

## 🍎 macOS Requirements
- This extension uses the native `afplay` utility.
- Supports `.mp3`, `.wav`, `.aiff`, and `.m4a` files.

## Release Notes

### 2.1.0

- Added Earthquake System Shell Hook for Zsh.
- Added custom icon.
- Improved configuration and volume support.

### 0.0.1

Initial release.

## 📄 License
MIT © tamiopia
