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
            const platform = os.platform();
            const homeDir = os.homedir();
            const targetDir = path.join(homeDir, '.earthquake-terminal-sound');
            const targetSoundPath = path.join(targetDir, 'error.mp3');
            const sourceSoundPath = context.asAbsolutePath(path.join('assets', 'error.mp3'));

            // 1. Create stable directory for the sound
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // 2. Copy the sound file
            fs.copyFileSync(sourceSoundPath, targetSoundPath);

            if (platform === 'darwin') {
                const zshrcPath = path.join(homeDir, '.zshrc');
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
                if (fs.existsSync(zshrcPath)) {
                    const content = fs.readFileSync(zshrcPath, 'utf8');
                    if (!content.includes('earthquake_hook')) {
                        fs.appendFileSync(zshrcPath, hookCode);
                        vscode.window.showInformationMessage('Successfully installed Earthquake Sound to your .zshrc! Please restart your terminal.');
                    } else {
                        vscode.window.showInformationMessage('Earthquake Sound is already installed in your .zshrc.');
                    }
                } else {
                    fs.writeFileSync(zshrcPath, hookCode);
                    vscode.window.showInformationMessage('Created .zshrc and installed Earthquake Sound! Please restart your terminal.');
                }
            } else if (platform === 'win32') {
                // Windows PowerShell Support
                const psProfileDir = path.join(homeDir, 'Documents', 'WindowsPowerShell');
                const psProfilePath = path.join(psProfileDir, 'Microsoft.PowerShell_profile.ps1');
                
                const hookCode = `
# Earthquake Terminal Sound Hook
function Earthquake-Hook {
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 130) {
        Add-Type -AssemblyName PresentationCore
        $player = New-Object System.Windows.Media.MediaPlayer
        $player.Open('${targetSoundPath}')
        $player.Play()
        Start-Sleep -s 2
    }
}
if (!(Get-Command prompt | Select-Object -ExpandProperty Definition | Select-String "Earthquake-Hook")) {
    $OldPrompt = $ExecutionContext.InvokeCommand.GetCommand('prompt', 'Function')
    function prompt {
        Earthquake-Hook
        if ($OldPrompt) { &$OldPrompt } else { "PS $($ExecutionContext.SessionState.Path.CurrentLocation)> " }
    }
}
`;
                if (!fs.existsSync(psProfileDir)) {
                    fs.mkdirSync(psProfileDir, { recursive: true });
                }

                if (fs.existsSync(psProfilePath)) {
                    const content = fs.readFileSync(psProfilePath, 'utf8');
                    if (!content.includes('Earthquake-Hook')) {
                        fs.appendFileSync(psProfilePath, hookCode);
                        vscode.window.showInformationMessage('Successfully installed Earthquake Sound to your PowerShell profile! Please restart your terminal.');
                    } else {
                        vscode.window.showInformationMessage('Earthquake Sound is already installed in your PowerShell profile.');
                    }
                } else {
                    fs.writeFileSync(psProfilePath, hookCode);
                    vscode.window.showInformationMessage('Created PowerShell profile and installed Earthquake Sound! Please restart your terminal.');
                }
            } else {
                vscode.window.showWarningMessage(`Shell hook installation is not yet supported for ${platform}.`);
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
    
    const volume = config.get<number>('volume', 1.0);
    const platform = os.platform();
    let command = '';

    if (platform === 'darwin') {
        command = `afplay -v ${volume} "${soundPath}"`;
    } else if (platform === 'win32') {
        // PowerShell command for Windows
        command = `powershell -c "Add-Type -AssemblyName PresentationCore; $m = New-Object System.Windows.Media.MediaPlayer; $m.Open('${soundPath}'); $m.Volume = ${volume}; $m.Play(); Start-Sleep -s 2"`;
    } else {
        // Linux support (using paplay or aplay)
        command = `paplay "${soundPath}" || aplay "${soundPath}"`;
    }

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error playing sound: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to play sound. Check if the sound path is correct: ${soundPath}`);
        }
    });
}

export function deactivate() {}
