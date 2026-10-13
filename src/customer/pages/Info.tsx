// Kurulum, Yardım, Gizlilik ve KVKK sayfaları.

import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, Share } from 'lucide-react';
import { isIos } from '../../lib/pushService';
import { useCustomer } from '../context';
import { BackLink, Btn, Card, H1, Page, Ring, StepMark, useL } from '../ui';

// ---------------------------------------------------------------- kurulum
export const SetupPage: React.FC = () => {
  const L = useL();
  const { setup, vehicles, go, back, push, enablePushNow, standalone, canInstall, install, toast } = useCustomer();
  const [howOpen, setHowOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const free = vehicles.find((v) => !v.tagCode);
  const act = (label: string, fn: () => void) => <button type="button" onClick={fn} disabled={busy} className="text-[14px] font-semibold whitespace-nowrap disabled:opacity-50" style={{ color: 'var(--c-pt)' }}>{label}</button>;
  const step = (done: boolean, title: string, desc: string, action?: React.ReactNode, first?: boolean) => (
    <div className="flex items-start gap-[13px] px-4 py-4" style={{ borderTop: first ? undefined : '1px solid var(--c-ln)' }}>
      <StepMark done={done} />
      <div className="flex-1 min-w-0"><div className="text-[15px] font-semibold" style={{ color: done ? 'var(--c-fn)' : 'var(--c-tx)', textDecoration: done ? 'line-through' : undefined }}>{title}</div><div className="text-[13px] mt-[3px] leading-snug" style={{ color: 'var(--c-fn)' }}>{desc}</div></div>
      {!done && action}
    </div>
  );
  const s = Object.fromEntries(setup.steps.map((x) => [x.key, x]));
  const pushDesc = push === 'on' ? L('Bu cihazda açık.', 'On for this device.')
    : push === 'ios-install' ? L('iPhone’da önce ana ekrana ekleyin, sonra bildirimleri açın.', 'On iPhone, add to Home Screen first.')
      : push === 'denied' ? L('Tarayıcı ayarlarından bu site için bildirim izni veriniz.', 'Allow notifications in browser settings.')
        : !s.push?.available ? L('Bu tarayıcı bildirimleri desteklemiyor; bu adım sayılmaz.', 'Not supported here; this step is skipped.')
          : L('QR okutulduğunda anında haber alın.', 'Get notified instantly.');
  const addHome = async () => {
    if (canInstall) { const ok = await install(); if (ok) toast(L('Uygulama ana ekrana eklendi.', 'Added to Home Screen.')); }
    else setHowOpen(true);
  };
  return (
    <Page wide={640}>
      <BackLink label={L('Geri', 'Back')} onClick={back} />
      <div className="flex items-center gap-4"><Ring pct={setup.pct} size={68} /><div><H1>{L('Kurulum', 'Setup')}</H1><div className="text-[14px] mt-1 leading-snug" style={{ color: 'var(--c-mu)' }}>{setup.complete ? L('Kurulum tamamlandı. Her şey hazır.', 'Setup is complete.') : L('Uygulamanın tam çalışması için kalan adımları tamamlayın.', 'Complete the remaining steps.')}</div></div></div>
      <Card className="mt-[22px]">
        {step(true, L('Hesap oluşturun', 'Create an account'), L('Tamamlandı', 'Done'), undefined, true)}
        {step(!!s.vehicle?.done, L('Aracınızı ekleyin', 'Add your vehicle'), s.vehicle?.done ? vehicles.map((v) => v.plateNumber).join(', ') : L('Plaka ve marka-model yeterli.', 'Plate and model are enough.'), act(L('Ekle', 'Add'), () => go('vehicleAdd')))}
        {step(!!s.qr?.done, L('QR etiketini bağlayın', 'Link the QR tag'), s.qr?.done ? L('En az bir aracınızda etiket bağlı.', 'At least one vehicle has a tag.') : free ? L(`${free.plateNumber} aracında etiket yok.`, `${free.plateNumber} has no tag.`) : L('Önce bir araç ekleyin.', 'Add a vehicle first.'), free ? act(L('Bağla', 'Link'), () => go('linkQr', { id: free.id })) : undefined)}
        {step(!!s.push?.done || !s.push?.available, L('Telefon bildirimlerini açın', 'Turn on notifications'), pushDesc, push === 'off' ? act(L('Aç', 'Turn on'), async () => { setBusy(true); try { await enablePushNow(); } finally { setBusy(false); } }) : push === 'denied' || push === 'ios-install' ? act(L('Ayrıntı', 'Details'), () => go('notices')) : undefined)}
      </Card>
      <Card className="mt-3">{step(standalone, L('Ana ekrana ekleyin', 'Add to Home Screen'), standalone ? L('Uygulama ana ekranınızda.', 'The app is on your Home Screen.') : L('İsteğe bağlı · uygulama gibi açılır, bildirimler daha güvenilir gelir (iPhone’da gerekli).', 'Optional · opens like an app; required for notifications on iPhone.'), act(canInstall ? L('Ekle', 'Add') : L('Nasıl?', 'How?'), addHome), true)}</Card>
      {howOpen && !standalone && (
        <Card className="mt-3 px-4 py-4">
          <div className="text-[14px] font-semibold flex items-center gap-2" style={{ color: 'var(--c-tx)' }}><Share className="w-4 h-4" />{L('Ana ekrana ekleme', 'Adding to Home Screen')}</div>
          <ol className="m-0 mt-2 pl-5 text-[13.5px] leading-relaxed" style={{ color: 'var(--c-mu)' }}>
            {isIos()
              ? <><li>{L('Safari’de alttaki Paylaş düğmesine dokunun.', 'Tap Share in Safari.')}</li><li>{L('“Ana Ekrana Ekle”yi seçin ve “Ekle”ye dokunun.', 'Choose “Add to Home Screen”.')}</li></>
              : <><li>{L('Tarayıcının menüsünü (⋮) açın.', 'Open the browser menu (⋮).')}</li><li>{L('“Uygulamayı yükle” ya da “Ana ekrana ekle”yi seçin.', 'Choose “Install app” or “Add to Home screen”.')}</li></>}
          </ol>
        </Card>
      )}
      <p className="m-0 mt-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-fn)' }}>{L('Sayfaların üstündeki kurulum kartını kapatabilirsiniz; kurulum tamamlanana kadar sayfaya her yeni girişte yeniden görünür.', 'You can close the setup card; it reappears until setup is complete.')}</p>
    </Page>
  );
};

// ---------------------------------------------------------------- yardım
const FAQ: { q: [string, string]; a: [string, string] }[] = [
  { q: ['QR etiketini aracıma nasıl bağlarım?', 'How do I link the QR tag to my vehicle?'], a: ['Araçlarım sayfasında aracın altındaki “QR etiketi bağlayın” satırına dokunun. Etiketteki QR’ı kamerayla okutun ya da etiketin altındaki 12 karakterlik kodu yazın. Etiket o araca ve hesabınıza bağlanır.', 'On My vehicles, tap “Link a QR tag” under the vehicle and scan the tag or type its 12-character code.'] },
  { q: ['QR’ı okutan kişi neleri görür?', 'What does the person scanning see?'], a: ['Yalnızca maskeli plakanızı (ör. 34 HPJ ••5), aracın marka ve modelini ve eklediyseniz notunuzu görür. Adınız, telefon numaranız ve e-posta adresiniz hiçbir zaman gösterilmez.', 'Only your masked plate, the model and your note. Never your name, phone or email.'] },
  { q: ['Etiketim kaybolursa ya da çalınırsa ne yapmalıyım?', 'What if my tag is lost or stolen?'], a: ['Araçlarım sayfasında aracı açın ve “Kayıp / çalıntı bildir”e dokunun. Etiket hemen ve kalıcı olarak kapatılır; aynı araca yeni bir etiket bağlayabilirsiniz.', 'Open the vehicle and tap “Report lost”. The tag is disabled immediately and permanently.'] },
  { q: ['Bildirimler telefonuma neden gelmiyor?', 'Why am I not getting notifications?'], a: ['Bildirimler her cihazda ayrı açılır. Bildirimler sayfasında “Bu cihaza bildirim gönder” ayarını açın ve “Deneme bildirimi gönder” ile kontrol edin. Tarayıcıda izin kapalıysa ayarlardan bu site için bildirimlere izin verin.', 'Notifications are per device. Turn them on in Notifications and send a test.'] },
  { q: ['iPhone’da bildirimleri nasıl açarım?', 'How do I enable notifications on iPhone?'], a: ['iPhone’da bildirim alabilmek için siteyi Safari’den ana ekrana eklemeniz gerekir: Paylaş → Ana Ekrana Ekle. Ardından ana ekrandaki simgeden açıp Bildirimler sayfasından bildirimleri açın.', 'Add the site to your Home Screen from Safari, open it from the icon and enable notifications.'] },
  { q: ['Bir hesaba kaç araç ekleyebilirim?', 'How many vehicles can I add?'], a: ['Birden fazla araç ekleyebilirsiniz. Her araca ayrı bir QR etiketi bağlanır.', 'You can add several vehicles; each gets its own QR tag.'] },
  { q: ['QR etiketini başka bir araca taşıyabilir miyim?', 'Can I move a tag to another vehicle?'], a: ['Evet. Aracın sayfasından “Araçtan ayır” ile etiketi ayırın, ardından diğer aracınıza bağlayın. Etiket her zaman sizin hesabınızda kalır.', 'Yes. Unlink it from one vehicle, then link it to another.'] },
  { q: ['Hesabımı nasıl silerim?', 'How do I delete my account?'], a: ['Profil sayfasının en altındaki “Hesabımı kalıcı olarak sil” bağlantısını kullanabilirsiniz. Araçlarınız, bildirimleriniz ve destek talepleriniz silinir; bağlı etiketleriniz kapatılır.', 'Use “Delete my account permanently” at the bottom of the Profile page.'] },
];

export const HelpPage: React.FC<{ signedIn: boolean; go: (r: 'support' | 'signin') => void; back: () => void }> = ({ signedIn, go, back }) => {
  const L = useL();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number>(0);
  const list = useMemo(() => {
    const s = q.trim().toLocaleLowerCase('tr-TR');
    return FAQ.map((f, i) => ({ ...f, i })).filter((f) => !s || L(f.q[0], f.q[1]).toLocaleLowerCase('tr-TR').includes(s) || L(f.a[0], f.a[1]).toLocaleLowerCase('tr-TR').includes(s));
  }, [q, L]);
  return (
    <Page>
      <BackLink label={L('Geri', 'Back')} onClick={back} />
      <H1>{L('Yardım', 'Help')}</H1>
      <label className="mt-4 flex items-center gap-[10px] rounded-[10px] px-[14px] py-[12px] lg:max-w-[520px]" style={{ background: 'var(--c-sf)', border: '1px solid var(--c-ln2)' }}>
        <Search className="w-[17px] h-[17px]" style={{ color: 'var(--c-fn)' }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Soru ara', 'Search questions')} aria-label={L('Soru ara', 'Search questions')} className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-[var(--c-ph)]" style={{ color: 'var(--c-tx)' }} />
      </label>
      <Card className="mt-4">
        {list.length === 0 && <p className="m-0 px-4 py-6 text-center text-[14px]" style={{ color: 'var(--c-fn)' }}>{L('Eşleşen soru bulunamadı.', 'No matching question.')}</p>}
        {list.map((f, k) => {
          const on = open === f.i;
          return (
            <div key={f.i} style={{ borderTop: k ? '1px solid var(--c-ln)' : undefined }}>
              <button type="button" onClick={() => setOpen(on ? -1 : f.i)} aria-expanded={on} className="w-full flex items-center gap-3 px-4 py-[15px] text-left">
                <span className="flex-1 text-[15px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L(f.q[0], f.q[1])}</span>
                <ChevronDown className="w-[17px] h-[17px] shrink-0 transition-transform" style={{ color: 'var(--c-fn)', transform: on ? 'rotate(180deg)' : undefined }} />
              </button>
              {on && <p className="m-0 px-4 pb-4 -mt-1 text-[14px] leading-relaxed" style={{ color: 'var(--c-mu)' }}>{L(f.a[0], f.a[1])}</p>}
            </div>
          );
        })}
      </Card>
      <Card className="mt-5 px-5 py-[18px] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-center lg:text-left">
        <div><div className="text-[15px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L('Sorunuz çözülmedi mi?', 'Still need help?')}</div><div className="text-[13.5px] mt-1" style={{ color: 'var(--c-mu)' }}>{L('Talepleriniz en geç 24 saat içinde yanıtlanır.', 'We reply within 24 hours.')}</div></div>
        <Btn kind="secondary" onClick={() => go(signedIn ? 'support' : 'signin')} className="!text-[var(--c-pt)]">{L('Destek talebi oluştur', 'Create a support request')}</Btn>
      </Card>
    </Page>
  );
};

// ---------------------------------------------------------------- gizlilik
const PRIVACY: { id: string; t: [string, string]; p: [string, string][] }[] = [
  { id: 'veri', t: ['Hangi bilgileri topluyoruz', 'What we collect'], p: [
    ['Hesap bilgileri: e-posta adresiniz ve isteğe bağlı olarak adınız ile cep telefonu numaranız.', 'Account: your email and optionally your name and mobile number.'],
    ['Araç bilgileri: plaka, marka-model, QR’ı okutana gösterilecek notunuz ve bildirim tercihiniz.', 'Vehicle: plate, model, your note and message preference.'],
    ['Cihaz bilgileri: bildirim izni, uygulamanın ana ekrana eklenip eklenmediği gibi teknik bilgiler.', 'Device: notification permission and whether the app is installed.'],
    ['QR okutmaları: hangi gün kaç kez okutulduğu ve okutan kişinin gönderdiği hazır mesaj. Okutan kişinin kimliği istenmez.', 'Scans: daily counts and the message sent. The scanner is not identified.'],
  ] },
  { id: 'amac', t: ['Bilgileriniz ne için kullanılır', 'How we use it'], p: [
    ['QR etiketiniz okutulduğunda size bildirim iletmek, hesabınızı ve araçlarınızı yönetmenizi sağlamak ve destek taleplerinizi sonuçlandırmak için kullanılır. Bilgileriniz reklam amacıyla kullanılmaz ve satılmaz.', 'To notify you, manage your account and vehicles, and handle support requests. Never sold or used for ads.'],
  ] },
  { id: 'okutan', t: ['QR’ı okutan kişi neleri görür', 'What the scanner sees'], p: [
    ['Yalnızca maskeli plakanızı (ör. 34 HPJ ••5), aracın marka ve modelini ve eklediyseniz notunuzu görür. Adınız, telefon numaranız ve e-posta adresiniz hiçbir koşulda gösterilmez.', 'Only your masked plate, the model and your note. Never your name, phone or email.'],
  ] },
  { id: 'guvenlik', t: ['Güvenlik', 'Security'], p: [
    ['Telefon numaranız şifrelenerek saklanır; yöneticiler yalnızca son iki hanesini görebilir. Müşteri kayıtlarına erişim kayıt altına alınır.', 'Your phone is stored encrypted; staff only see the last two digits. Access is logged.'],
  ] },
  { id: 'sure', t: ['Saklama süreleri', 'Retention'], p: [
    ['Hesabınızı sildiğinizde araçlarınız, bildirimleriniz ve destek talepleriniz silinir; yalnızca gizlenmiş e-posta adresi, silinme tarihi ve araç/etiket sayıları gibi asgari bir kayıt tutulur. Kapatılan destek talepleri 2 yıl sonra kendiliğinden silinir.', 'Deleting your account removes your data; only a minimal record is kept. Closed requests are deleted after 2 years.'],
  ] },
  { id: 'haklar', t: ['Haklarınız (KVKK 11. madde)', 'Your rights'], p: [
    ['Kişisel verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini ya da silinmesini isteme haklarına sahipsiniz. Bilgilerinizi Profil sayfasından düzeltebilir, hesabınızı aynı sayfadan kalıcı olarak silebilirsiniz.', 'You can learn, correct or delete your data. Use the Profile page to edit or delete.'],
  ] },
  { id: 'iletisim', t: ['İletişim', 'Contact'], p: [
    ['Kişisel verilerinizle ilgili taleplerinizi Destek Talepleri sayfasından “Gizlilik ve kişisel veriler” konusunu seçerek iletebilirsiniz.', 'Send privacy requests via Support requests with the “Privacy” topic.'],
  ] },
];

export const PrivacyPage: React.FC<{ back: () => void }> = ({ back }) => {
  const L = useL();
  const [active, setActive] = useState(PRIVACY[0].id);
  const jump = (id: string) => { setActive(id); document.getElementById(`pv-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <Page wide={900}>
      <BackLink label={L('Geri', 'Back')} onClick={back} />
      <H1 sub={L('Son güncelleme: Ekim 2026', 'Last updated: October 2026')}>{L('Gizlilik ve KVKK', 'Privacy')}</H1>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-9 items-start">
        <nav className="hidden lg:flex flex-col gap-[2px] sticky top-[84px]" aria-label={L('Bölümler', 'Sections')}>
          {PRIVACY.map((s) => <button key={s.id} type="button" onClick={() => jump(s.id)} className="text-left text-[14px] px-3 py-2 rounded-[8px]" style={active === s.id ? { background: 'var(--c-tint)', color: 'var(--c-pt)', fontWeight: 600 } : { color: 'var(--c-mu)' }}>{L(s.t[0], s.t[1])}</button>)}
        </nav>
        <div>
          {PRIVACY.map((s, i) => (
            <section key={s.id} id={`pv-${s.id}`} className={i ? 'mt-7' : ''} style={{ scrollMarginTop: 84 }}>
              <h2 className="m-0 text-[17px] lg:text-[18px] font-bold" style={{ color: 'var(--c-tx)' }}>{L(s.t[0], s.t[1])}</h2>
              {s.p.map((p, k) => <p key={k} className="m-0 mt-2 text-[15px] leading-[1.7]" style={{ color: 'var(--c-mu)' }}>{L(p[0], p[1])}</p>)}
            </section>
          ))}
        </div>
      </div>
    </Page>
  );
};
