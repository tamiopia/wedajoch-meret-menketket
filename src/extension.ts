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
            const soundFileName = platform === 'win32' ? 'error.wav' : 'error.mp3';
            const targetSoundPath = path.join(targetDir, soundFileName);
            const sourceSoundPath = context.asAbsolutePath(path.join('assets', soundFileName));

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
                
                const hookFunction = `function Earthquake-Hook {
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 130) {
        ${getWindowsWaveHelper()}
        [EarthquakeWavePlayer]::Play('${targetSoundPath.replace(/'/g, "''")}', 1000)
    }
}`;
                const hookCode = `
# Earthquake Terminal Sound Hook
${hookFunction}
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
                    if (/^function Earthquake-Hook \{[\s\S]*?^\}/m.test(content)) {
                        const updatedContent = content.replace(
                            /^function Earthquake-Hook \{[\s\S]*?^\}/m,
                            hookFunction
                        );
                        fs.writeFileSync(psProfilePath, updatedContent);
                        vscode.window.showInformationMessage('Updated Earthquake Sound in your PowerShell profile! Please restart your terminal.');
                    } else if (!content.includes('Earthquake-Hook')) {
                        fs.appendFileSync(psProfilePath, hookCode);
                        vscode.window.showInformationMessage('Successfully installed Earthquake Sound to your PowerShell profile! Please restart your terminal.');
                    } else {
                        vscode.window.showWarningMessage('Earthquake Sound was found in your PowerShell profile but could not be updated automatically. Please remove the old hook and install it again.');
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
    const platform = os.platform();
    let soundPath = config.get<string>('soundPath');
    
    // Use WAV on Windows to avoid MP3 decoder inconsistencies in MCI.
    if (!soundPath) {
        const soundFileName = platform === 'win32' ? 'error.wav' : 'error.mp3';
        soundPath = context.asAbsolutePath(path.join('assets', soundFileName));
    }
    
    const volume = config.get<number>('volume', 1.0);
    let command = '';

    if (platform === 'darwin') {
        command = `afplay -v ${volume} "${soundPath}"`;
    } else if (platform === 'win32') {
        const escapedSoundPath = soundPath.replace(/'/g, "''");
        const volumeThousandths = Math.round(volume * 1000);
        const script = path.extname(soundPath).toLowerCase() === '.wav'
            ? `$ErrorActionPreference = 'Stop'\n${getWindowsWaveHelper()}\n[EarthquakeWavePlayer]::Play('${escapedSoundPath}', ${volumeThousandths})`
            : `$ErrorActionPreference = 'Stop'\n${getWindowsMciHelper()}\nPlay-EarthquakeSound -Path '${escapedSoundPath}' -Volume ${volumeThousandths}`;
        const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
        command = `powershell.exe -NoProfile -NonInteractive -STA -EncodedCommand ${encodedScript}`;
    } else {
        // Linux support (using paplay or aplay)
        command = `paplay "${soundPath}" || aplay "${soundPath}"`;
    }

    exec(command, (error, stdout, stderr) => {
        if (error) {
            const details = stderr.trim() || error.message;
            console.error(`Error playing sound: ${details}`);
            vscode.window.showErrorMessage(`Failed to play sound: ${details}`);
        }
    });
}

function getWindowsMciHelper(): string {
    return `
if (-not ('EarthquakeMci' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class EarthquakeMci {
    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    public static extern int mciSendString(string command, StringBuilder result, int length, IntPtr callback);
    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    private static extern int mciGetErrorString(int errorCode, StringBuilder message, int length);
    public static void Send(string command) {
        int result = mciSendString(command, null, 0, IntPtr.Zero);
        if (result != 0) {
            StringBuilder message = new StringBuilder(256);
            mciGetErrorString(result, message, message.Capacity);
            throw new InvalidOperationException(message.ToString());
        }
    }
}
'@
}
function Play-EarthquakeSound {
    param([string]$Path, [ValidateRange(0, 1000)][int]$Volume = 1000)
    $opened = $false
    try {
        $deviceType = if ([IO.Path]::GetExtension($Path) -ieq '.wav') { 'waveaudio' } else { 'mpegvideo' }
        [EarthquakeMci]::Send(('open "' + $Path + '" type ' + $deviceType + ' alias earthquakeSound'))
        $opened = $true
        [EarthquakeMci]::Send("setaudio earthquakeSound volume to $Volume")
        [EarthquakeMci]::Send('play earthquakeSound wait')
    } finally {
        if ($opened) {
            [void][EarthquakeMci]::mciSendString('close earthquakeSound', $null, 0, [IntPtr]::Zero)
        }
    }
}
`;
}

function getWindowsWaveHelper(): string {
    return `
if (-not ('EarthquakeWavePlayer' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Media;

public static class EarthquakeWavePlayer {
    public static void Play(string path, int volume) {
        byte[] data = File.ReadAllBytes(path);
        int format = -1;
        int bitsPerSample = 0;
        int dataOffset = -1;
        int dataLength = 0;

        for (int offset = 12; offset + 8 <= data.Length;) {
            int chunkLength = BitConverter.ToInt32(data, offset + 4);
            int payloadOffset = offset + 8;
            if (chunkLength < 0 || payloadOffset + chunkLength > data.Length) {
                throw new InvalidDataException("Invalid WAV chunk size.");
            }
            string chunkId = System.Text.Encoding.ASCII.GetString(data, offset, 4);
            if (chunkId == "fmt " && chunkLength >= 16) {
                format = BitConverter.ToInt16(data, payloadOffset);
                bitsPerSample = BitConverter.ToInt16(data, payloadOffset + 14);
            } else if (chunkId == "data") {
                dataOffset = payloadOffset;
                dataLength = chunkLength;
            }
            offset = payloadOffset + chunkLength + (chunkLength & 1);
        }

        if (format != 1 || bitsPerSample != 16 || dataOffset < 0 || dataLength % 2 != 0) {
            throw new InvalidDataException("Windows WAV playback requires 16-bit PCM audio.");
        }
        if (volume < 0 || volume > 1000) {
            throw new ArgumentOutOfRangeException("volume");
        }
        if (volume != 1000) {
            int end = dataOffset + dataLength;
            for (int offset = dataOffset; offset < end; offset += 2) {
                int sample = BitConverter.ToInt16(data, offset);
                int scaled = (int)Math.Round(sample * volume / 1000.0);
                scaled = Math.Max(short.MinValue, Math.Min(short.MaxValue, scaled));
                data[offset] = (byte)(scaled & 0xff);
                data[offset + 1] = (byte)((scaled >> 8) & 0xff);
            }
        }

        using (MemoryStream stream = new MemoryStream(data, false))
        using (SoundPlayer player = new SoundPlayer(stream)) {
            player.Load();
            player.PlaySync();
        }
    }
}
'@
}
`;
}

export function deactivate() {}
