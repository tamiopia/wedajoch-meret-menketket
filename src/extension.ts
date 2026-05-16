import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {
    console.log('Terminal Error Sound extension is now active');

    // Register listener for terminal shell execution end
    const disposable = vscode.window.onDidEndTerminalShellExecution(event => {
        const config = vscode.workspace.getConfiguration('terminal-error-sound');
        const isEnabled = config.get<boolean>('enabled', true);

        if (!isEnabled) {
            return;
        }

        // Check if the command finished with a non-zero exit code
        if (event.exitCode !== undefined && event.exitCode !== 0) {
            console.log(`Terminal command failed with exit code: ${event.exitCode}. Playing sound...`);
            playSound(context);
        }
    });

    // Register Test Sound command
    const testSoundCommand = vscode.commands.registerCommand('terminal-error-sound.testSound', () => {
        vscode.window.showInformationMessage('Playing test sound...');
        playSound(context);
    });

    // Register Toggle command
    const toggleCommand = vscode.commands.registerCommand('terminal-error-sound.toggle', () => {
        const config = vscode.workspace.getConfiguration('terminal-error-sound');
        const currentState = config.get<boolean>('enabled', true);
        config.update('enabled', !currentState, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Earthquake Terminal Sound is now ${!currentState ? 'enabled' : 'disabled'}`);
    });

    // Register Install Shell Hook command
    const installHookCommand = vscode.commands.registerCommand('terminal-error-sound.installShellHook', async () => {
        try {
            const homeDir = os.homedir();
            const zshrcPath = path.join(homeDir, '.zshrc');
            const targetDir = path.join(homeDir, '.earthquake-terminal-sound');
            const targetSoundPath = path.join(targetDir, 'error.mp3');
            const sourceSoundPath = context.asAbsolutePath(path.join('assets', 'error.mp3'));

            // 1. Create stable directory for the sound
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // 2. Copy the sound file
            fs.copyFileSync(sourceSoundPath, targetSoundPath);

            // 3. Prepare the hook code
            const hookCode = `
# Earthquake Terminal Sound Hook
earthquake_hook() {
    local last_status=$?
    if [ $last_status -ne 0 ] && [ $last_status -ne 130 ]; then
        afplay "${targetSoundPath}" &!
    fi
}
if ! [[ "$precmd_functions" == *earthquake_hook* ]]; then
    autoload -Uz add-zsh-hook
    add-zsh-hook precmd earthquake_hook
fi
`;

            // 4. Append to .zshrc if not already there
            if (fs.existsSync(zshrcPath)) {
                const content = fs.readFileSync(zshrcPath, 'utf8');
                if (!content.includes('earthquake_hook')) {
                    fs.appendFileSync(zshrcPath, hookCode);
                    vscode.window.showInformationMessage('Successfully installed Earthquake Sound to your .zshrc! Please restart your terminal or run "source ~/.zshrc".');
                } else {
                    vscode.window.showInformationMessage('Earthquake Sound is already installed in your .zshrc.');
                }
            } else {
                fs.writeFileSync(zshrcPath, hookCode);
                vscode.window.showInformationMessage('Created .zshrc and installed Earthquake Sound! Please restart your terminal.');
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to install shell hook: ${err.message}`);
        }
    });

    context.subscriptions.push(disposable, testSoundCommand, toggleCommand, installHookCommand);
}

function playSound(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('terminal-error-sound');
    let soundPath = config.get<string>('soundPath');
    
    // If no path is set, use the bundled error.mp3
    if (!soundPath) {
        soundPath = context.asAbsolutePath(path.join('assets', 'error.mp3'));
    }
    
    // For macOS, we use afplay
    const volume = config.get<number>('volume', 1.0);
    const command = `afplay -v ${volume} "${soundPath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error playing sound: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to play sound. Check if the sound path is correct: ${soundPath}`);
        }
    });
}

export function deactivate() {}
