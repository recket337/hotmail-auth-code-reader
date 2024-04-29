import fs from 'fs/promises';
import path from 'path';   
import { ImapFlow } from 'imapflow';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function readConfig(filePath) {
    try {
        const configFileData = await fs.readFile(filePath, 'utf8');
        const { subject, emailsFilePath } = JSON.parse(configFileData);

        const emailsConfigData = await fs.readFile(emailsFilePath, 'utf8');
        const emails = JSON.parse(emailsConfigData).data;

        return { subject, emails };
    } catch (error) {
        console.error('Error:', error);
    }
}

async function runEmailWatcher(emailParams, subject) {
    try {
        const imapFlow = new ImapFlow({
            host: 'imap-mail.outlook.com',
            port: 993,
            secure: true,
            tls: true,
            auth: {
                user: emailParams.email,
                pass: emailParams.password
            },
            proxy: emailParams.proxy ? new HttpsProxyAgent(`http://${emailParams.proxy}`) : null
        });

        await imapFlow.connect();

        const mailbox = await imapFlow.getMailbox('INBOX');
        await mailbox.open();

        const listener = await mailbox.watch();
        listener.on('data', async (mail) => {
            const messageHeader = await mail.getHeader('subject');
            const messageBody = await mail.getTextBody();
            if (messageHeader === subject && messageBody.includes('Your email verification code is')) {
                const code = messageBody.match(/Your email verification code is (\d+)\. It is valid for 5 minutes\./)[1];
                console.log(`ID: ${emailParams.id}, Email: ${emailParams.email}, Verification Code: ${code}, Received At: ${new Date().toISOString()}`);
            }
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

async function main() {
    try {
        const configFilePath = path.join(__dirname, 'config.json');
        const config = await readConfig(configFilePath);
        const { subject, emails } = config;

        for (const emailConfig of emails) {
            await runEmailWatcher(emailConfig, subject);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
