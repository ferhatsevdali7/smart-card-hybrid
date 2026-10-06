import React, { useState } from 'react';
import { 
  HelpCircle, ChevronDown, ChevronUp, X, 
  Smartphone, QrCode, ShieldAlert, KeyRound, Sparkles 
} from 'lucide-react';
import { Language, ThemeMode } from '../lib/i18n';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
  theme?: ThemeMode;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({
  isOpen,
  onClose,
  lang = 'tr',
  theme = 'dark'
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = lang === 'tr' ? [
    {
      q: 'Fiziksel Akıllı Kart NFC çipi telefonlarda nasıl okutulur?',
      a: 'Akıllı kartınızı telefonunuzun arka üst kısmına (iPhone’larda üst tepe noktasına, Android cihazlarda orta-üst NFC alanına) yaklaştırmanız yeterlidir. Herhangi bir uygulama yüklemenize gerek kalmadan saniyeler içinde profil açılır.'
    },
    {
      q: 'Acil durumlarda 112 ambulans veya ilk yardım ekipleri karta nasıl erişir?',
      a: 'Kartınızın ön yüzündeki dinamik QR kod veya NFC çipi okutulduğunda doğrudan tam ekran Sağlık Kartı açılır. Kan grubu, kritik alerjiler ve acil aranacak kişiler tek tıkla aranabilir formatta listelenir.'
    },
    {
      q: 'Sosyal Kartvizitimdeki IBAN ve telefon bilgilerim nasıl korunuyor?',
      a: 'Sosyal Kartvizit sayfanız açıldığında 30 saniyelik güvenlik geri sayımı başlar. Sayaç tamamlandığında sistem panosu (clipboard) sıfırlanır ve yetkisiz kopyalamalar önlenir.'
    },
    {
      q: 'Kripto Kasa (Crypto Vault) gerçekten sıfır bilgi (Zero-Knowledge) mi?',
      a: 'Evet! Kripto kasanızdaki tüm notlar PBKDF2 (100.000 iterasyon) ve AES-GCM 256-bit ile doğrudan tarayıcınızda şifrelenir. Belirlediğiniz PIN kodu sunucularımıza veya veritabanına asla gönderilmez.'
    },
    {
      q: 'Araç Kartı ne işe yarar?',
      a: 'Aracınızın camına veya konsoluna yerleştireceğiniz araç QR/NFC kodu sayesinde, hatalı park veya acil durumlarda diğer sürücüler kişisel numaranızı ifşa etmeden doğrudan sizinle iletişime geçebilir.'
    }
  ] : [
    {
      q: 'How does NFC scanning work on smartphones?',
      a: 'Simply hold your smart card to the top-back of your smartphone (near the camera on iPhones, or upper center on Android). The profile opens instantly without any app installation.'
    },
    {
      q: 'How do first responders access my Health Card in an emergency?',
      a: 'Scanning the front QR code or NFC chip immediately loads the full-screen Health SOS ID, displaying blood type, allergies, and one-tap emergency calls.'
    },
    {
      q: 'How are IBANs and phone numbers protected on the Social Card?',
      a: 'A 30-second security countdown activates upon opening. Once expired, the system clipboard is automatically wiped to prevent data exposure.'
    },
    {
      q: 'Is the Crypto Vault truly Zero-Knowledge?',
      a: 'Yes! Notes are encrypted directly in your browser using PBKDF2 + AES-GCM 256-bit. Your master PIN is never sent to the cloud or server.'
    },
    {
      q: 'What is the purpose of the Vehicle Card?',
      a: 'Place your Vehicle QR code on your windshield so other drivers can quickly notify you during parking or emergency incidents without exposing your private phone.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
      />

      <div className={`relative w-full max-w-lg ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-3xl p-6 sm:p-7 shadow-2xl z-10 space-y-5 max-h-[90vh] overflow-y-auto`}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#14798D] to-[#509BEC] flex items-center justify-center text-white font-bold shadow">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">{lang === 'tr' ? 'Yardım & Sıkça Sorulan Sorular' : 'Help & FAQ'}</h3>
              <p className="text-xs text-slate-400">{lang === 'tr' ? 'Akıllı Kart Kullanım Kılavuzu' : 'Smart Card User Guide'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FAQ Items Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                className={`border rounded-2xl transition-all overflow-hidden ${
                  isDark 
                    ? (isOpen ? 'bg-slate-950/80 border-[#14798D]/60' : 'bg-slate-950/30 border-slate-800 hover:border-slate-700') 
                    : (isOpen ? 'bg-slate-50 border-[#14798D]/60' : 'bg-white border-slate-200 hover:border-slate-300')
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left p-4 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-[#509BEC] shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>
                {isOpen && (
                  <div className={`px-4 pb-4 pt-1 text-xs sm:text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'} border-t border-slate-800/40`}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Support Info */}
        <div className="pt-2 text-center text-xs text-slate-400">
          {lang === 'tr' ? 'Sorularınız ve teknik destek için 7/24 iletişim hattı aktiftir.' : '24/7 technical support is available.'}
        </div>

      </div>
    </div>
  );
};
