import { useState } from 'react';
import { Copy, Mail, MessageCircle, Share2 } from 'lucide-react';
import { normalizeWhatsApp } from '../lib/billing';
import { Button, buttonClass } from './ui';

/**
 * Berbagi tanpa integrasi WhatsApp resmi: membuka WhatsApp/email dengan pesan
 * siap kirim. Tidak ada pesan yang terkirim otomatis.
 */
export function ShareActions({
  link,
  message,
  subject,
  whatsapp,
  email,
}: {
  link: string;
  message: string;
  subject: string;
  whatsapp: string | null;
  email: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const full = `${message}\n\n${link}`;
  const waUrl = `https://wa.me/${whatsapp ? normalizeWhatsApp(whatsapp) : ''}?text=${encodeURIComponent(full)}`;
  const mailUrl = `mailto:${email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(full)}`;
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Salin tautan ini:', link);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href={waUrl} target="_blank" rel="noreferrer" className={buttonClass('secondary')}>
        <MessageCircle className="h-4 w-4" /> WhatsApp{whatsapp ? '' : ' (pilih kontak)'}
      </a>
      <a href={mailUrl} className={buttonClass('secondary')}>
        <Mail className="h-4 w-4" /> Email
      </a>
      <Button variant="secondary" onClick={copy}>
        <Copy className="h-4 w-4" /> {copied ? 'Tersalin' : 'Salin tautan'}
      </Button>
      {canShare && (
        <Button variant="secondary" onClick={() => navigator.share({ title: subject, text: message, url: link }).catch(() => undefined)}>
          <Share2 className="h-4 w-4" /> Bagikan
        </Button>
      )}
    </div>
  );
}
