import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { uint8ArrayToBase64 } from './timesheetService';

/**
 * Handles exporting, downloading, and emailing the completed timesheet .xlsx
 */
export async function exportAndSendTimesheet({
  bytes,
  weekEnding,
  profile,
  recipientEmail,
}) {
  const cleanName = (profile.employeeName || 'Technician').replace(/\s+/g, '_');
  const cleanDate = (weekEnding || new Date().toISOString().split('T')[0]).replace(/[^0-9-]/g, '_');
  const fileName = `Timesheet_${cleanName}_${cleanDate}.xlsx`;
  const subject = `Timesheet - ${profile.employeeName || 'Tapuosi Latunipulu'} - Week Ending ${weekEnding}`;
  const emailBody = `Hi,\n\nPlease find attached my signed IT Hero Timesheet for week ending ${weekEnding}.\n\nTotal details filled.\n\nRegards,\n${profile.employeeName || 'Tapuosi Latunipulu'}`;

  // 1. Web Environment
  if (Platform.OS === 'web' || typeof window !== 'undefined' && window.document) {
    try {
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also trigger mailto: so user can send immediately
      if (recipientEmail) {
        setTimeout(() => {
          const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
          window.open(mailtoUrl, '_blank');
        }, 500);
      }

      return {
        success: true,
        method: 'web_download',
        fileName,
        message: `Timesheet downloaded as ${fileName} and email prepared!`,
      };
    } catch (err) {
      console.error('Web export error:', err);
      throw err;
    }
  }

  // 2. Mobile Environment (Expo Go / Native iOS / Android)
  try {
    const base64Data = uint8ArrayToBase64(bytes);
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let mailSent = false;
    const canMail = await MailComposer.isAvailableAsync();
    if (canMail) {
      try {
        await MailComposer.composeAsync({
          recipients: recipientEmail ? [recipientEmail] : [profile.defaultEmail || ''],
          subject,
          body: emailBody,
          attachments: [fileUri],
        });
        mailSent = true;
      } catch (mailErr) {
        console.warn('Mail composer error, falling back to share:', mailErr);
      }
    }

    // Also offer direct native Share Sheet (to Save to Files, AirDrop, Slack, WhatsApp)
    if (!mailSent && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Share / Save ${fileName}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }

    return {
      success: true,
      method: mailSent ? 'email_attachment' : 'native_share',
      fileUri,
      fileName,
      message: `Timesheet saved & shared: ${fileName}`,
    };
  } catch (err) {
    console.error('Native export error:', err);
    throw err;
  }
}
