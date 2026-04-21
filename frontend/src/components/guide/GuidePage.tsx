const STRATEGIES = [
  {
    name: 'Sakin',
    color: '#059669',
    bg: 'rgba(5,150,105,0.07)',
    minSourceDOS: 14, maxReceiverDOS: 7, minInventory: 3, maxTransfer: '5 adet',
    desc: 'Yalnızca belirgin dengesizliklerde hareket eder. Kaynak mağaza en az 14 günlük stoka sahip olmalı, alıcı mağaza 7 günün altında olmalı.',
  },
  {
    name: 'Kontrollü',
    color: '#d97706',
    bg: 'rgba(217,119,6,0.07)',
    minSourceDOS: 10, maxReceiverDOS: 5, minInventory: 2, maxTransfer: '10 adet',
    desc: 'Dengeli risk/performans. Orta ölçekli fırsatları yakalar; kaynak ve alıcı arasında makul bir DOS farkı yeterlidir.',
  },
  {
    name: 'Agresif',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.07)',
    minSourceDOS: 7, maxReceiverDOS: 3, minInventory: 1, maxTransfer: '∞',
    desc: 'Maksimum performans odaklı. Küçük fırsatları bile kaçırmaz; transfer üst sınırı yoktur. Büyük operasyonlar için uygundur.',
  },
];

const PARAMS = [
  {
    key: 'minSourceDOS',
    label: 'Min. Kaynak Kapama (gün)',
    icon: '🔒',
    desc: 'Kaynak mağazada transferden sonra kalması gereken minimum günlük stok miktarı. "Bu mağaza transferin ardından en az kaç günlük stoğa sahip olmalı?" sorusunu yanıtlar.',
    example: '14 → Transfer sonrası kaynakta en az 14 günlük satış karşılığı stok kalır.',
    role: 'Kaynak koruma',
    color: '#1d4ed8',
  },
  {
    key: 'maxReceiverDOS',
    label: 'Max. Alıcı Kapama (gün)',
    icon: '🎯',
    desc: 'Yalnızca bu değerin altında stoku olan mağazalara transfer önerilir. "Alıcı ne kadar acil?" eşiğidir. Düşük değer = yalnızca kritik ihtiyaç.',
    example: '7 → Stoku 7 günün altında kalan mağazalar alıcı olarak seçilir.',
    role: 'Transfer tetikleyici',
    color: '#d97706',
  },
  {
    key: 'minInventory',
    label: 'Min. Stok (adet)',
    icon: '📦',
    desc: 'Kaynakta kalması gereken mutlak minimum adet. Günlük satış hızından bağımsız, her koşulda bu kadar ürün kaynak mağazada bırakılır.',
    example: '3 → Kaynak mağazada en az 3 adet kalacak şekilde transfer hesaplanır.',
    role: 'Güvenlik tabanı',
    color: '#059669',
  },
  {
    key: 'maxTransfer',
    label: 'Max. Transfer (adet)',
    icon: '🚚',
    desc: 'Tek bir öneride transfer edilebilecek maksimum adet. DOS hesabı daha fazla önerirse bu değerle kırpılır. null = sınırsız.',
    example: '5 → Kaç adet hesaplanırsa hesaplansın en fazla 5 adet önerilir.',
    role: 'Hard cap',
    color: '#7c3aed',
  },
  {
    key: 'deadStockStrThreshold',
    label: 'Ölü Stok Eşiği (STR%)',
    icon: '💀',
    desc: 'STR (Sell-Through Rate) bu eşiğin altında olan ürünler transfer edilmez. Hiçbir mağazada satılmayan ürünlerin başka mağazalara taşınmasını engeller.',
    example: '%15 → STR < %15 olan ürün "ölü stok" sayılır ve transfer önerisine dahil edilmez.',
    role: 'Ölü stok filtresi',
    color: '#6b7280',
  },
];

const TRANSFER_TYPES = [
  {
    name: 'Global',
    icon: '🌐',
    desc: 'Tüm mağazalar arasında DOS bazlı dengesizlikleri tarar. En düşük DOS\'a sahip mağaza alıcı, en yüksek DOS\'a sahip mağaza kaynak seçilir.',
    when: 'Genel stok optimizasyonu için.',
  },
  {
    name: 'Hedefli',
    icon: '📍',
    desc: 'Belirli bir mağazanın ihtiyacını karşılamak için en uygun kaynağı bulur. Önce öncelikli kaynakları (depo/online) dener, sonra diğer mağazalara bakar.',
    when: 'Belirli bir mağaza stoğunu güçlendirmek için.',
  },
  {
    name: 'Beden Tamamlama',
    icon: '👕',
    desc: 'Hedef mağazada stoğu sıfır olan beden/renk kombinasyonlarını tespit eder, her birine 1 adet önerir. DOS kontrolü yapmaz.',
    when: 'Raf görünümünü tamamlamak, size run oluşturmak için.',
  },
];

const STATUS_LEVELS = [
  { label: 'KRİTİK', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', range: '≤ 3 gün', desc: 'Stok kritik seviyede, çok yakında tükenecek.' },
  { label: 'DÜŞÜK',  color: '#d97706', bg: 'rgba(217,119,6,0.08)',  range: '4 – 7 gün', desc: 'Stok düşük, kısa sürede transfer gerekebilir.' },
  { label: 'NORMAL', color: '#059669', bg: 'rgba(5,150,105,0.08)',  range: '8 – 14 gün', desc: 'Stok yeterli düzeyde.' },
  { label: 'YÜKSEK', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', range: '> 14 gün', desc: 'Bol stok; bu mağaza potansiyel kaynak adayı.' },
];

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-up)',
      border: '1px solid var(--line)',
      borderRadius: 8,
      padding: '12px 16px',
      fontFamily: 'monospace',
      fontSize: '0.85rem',
      color: 'var(--ink)',
      lineHeight: 1.7,
      margin: '12px 0',
    }}>
      {children}
    </div>
  );
}

function CalloutBox({ icon, title, children, color = '#1d4ed8' }: { icon: string; title: string; children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: 14,
      background: `rgba(${color === '#1d4ed8' ? '29,78,216' : color === '#059669' ? '5,150,105' : '217,119,6'},0.06)`,
      border: `1px solid rgba(${color === '#1d4ed8' ? '29,78,216' : color === '#059669' ? '5,150,105' : '217,119,6'},0.18)`,
      borderRadius: 10,
      padding: '14px 16px',
      margin: '12px 0',
    }}>
      <span style={{ fontSize: '1.3rem', flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
      <div>
        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.85rem', color }}>{title}</p>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>{children}</p>
      </div>
    </div>
  );
}

export function GuidePage() {
  return (
    <div className="rf-page">
      {/* Header */}
      <div className="rf-page-header" style={{ marginBottom: 32 }}>
        <div>
          <p className="rf-page-eyebrow">Sistem Rehberi</p>
          <h1 className="rf-page-title">Strateji & Algoritma Kılavuzu</h1>
          <p className="rf-page-subtitle">
            RetailFlow nasıl çalışır, parametreler ne anlama gelir, transfer kararları nasıl alınır.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 860 }}>

        {/* ─── 1. Ne Yapıyor ─── */}
        <Section title="RetailFlow Ne Yapıyor?" subtitle="Sistemin temel amacı">
          <p style={{ fontSize: '0.88rem', color: 'var(--ink-soft)', lineHeight: 1.8, margin: '0 0 16px' }}>
            RetailFlow, mağazalar arası stok dengesizliklerini tespit ederek hangi ürünün hangi mağazadan hangisine taşınması gerektiğini önerir.
            Amaç iki şey: stoğu tükenecek mağazaları uyarmak ve bol stok bulunan mağazaların fazlasını değerlendirmek.
          </p>
          <CalloutBox icon="💡" title="Temel soru" color="#1d4ed8">
            "A mağazasındaki bu ürün 3 günde tükenir, B mağazasında ise aynı ürün 60 gün duracak. Neden transfer etmeyelim?"
          </CalloutBox>
        </Section>

        {/* ─── 2. Temel Kavramlar ─── */}
        <Section title="Temel Kavramlar" subtitle="Sistemin kullandığı metrikler">

          <div style={{ display: 'grid', gap: 16 }}>

            {/* STR */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>STR — Sell-Through Rate</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, background: 'var(--surface-up)', color: 'var(--ink-soft)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--line)' }}>İkincil metrik</span>
              </div>
              <FormulaBlock>STR = satış / (satış + stok)</FormulaBlock>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                Ne kadarının satıldığını gösterir. Ancak <strong>zamanı olmadığı için</strong> aciliyeti ölçemez:
                %70 STR "3 günde tükenecek" veya "30 günde tükenecek" anlamına gelebilir — ikisi çok farklı durumlardır.
                RetailFlow'da STR yalnızca ölü stok filtresi olarak kullanılır.
              </p>
            </div>

            {/* DOS */}
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>DOS — Days of Supply (Kapama Günü)</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent-text)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(29,78,216,0.2)' }}>Ana metrik</span>
              </div>
              <FormulaBlock>
                satış_hızı = toplam_satış / analiz_günü{'\n'}
                DOS = mevcut_stok / satış_hızı
              </FormulaBlock>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                "Bu mağaza mevcut satış hızıyla kaç gün daha dayanabilir?" sorusunu yanıtlar.
                DOS = 3 → 3 gün sonra tükenecek, <strong>acil!</strong> DOS = 90 → 3 ay dayanır, transfer ihtiyacı yok.
                Manhattan Associates, Blue Yonder, Relex gibi enterprise sistemlerin tamamı bu metriği birincil tetikleyici olarak kullanır.
              </p>
            </div>

            {/* Satış Hızı */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>Satış Hızı (velocity)</span>
              </div>
              <FormulaBlock>satış_hızı = toplam_satış / analiz_günü &nbsp;&nbsp;(adet/gün)</FormulaBlock>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                Analiz periyodunda günde ortalama kaç adet satıldığını gösterir.
                Hem DOS hesabında hem de transfer miktarı hesabında kullanılır.
                Analiz tarihi seçilmezse varsayılan 30 gündür.
              </p>
            </div>
          </div>
        </Section>

        {/* ─── 3. Transfer Tetikleyici ─── */}
        <Section title="Transfer Ne Zaman Tetiklenir?" subtitle="Bir ürün için transfer önerisi oluşturulabilmesi koşulları">
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.7 }}>
            Bir mağaza çiftinin transfer için uygun sayılması için <strong>tüm</strong> aşağıdaki koşulların sağlanması gerekir:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { step: '1', color: '#dc2626', title: 'Minimum stok kontrolü', body: 'Kaynak mağazada minInventory\'den fazla adet var mı? Yoksa transfer edilecek yeterli stok yok.' },
              { step: '2', color: '#d97706', title: 'Kaynak DOS kontrolü', body: 'Kaynak mağazanın mevcut DOS\'u minSourceDOS\'tan büyük mü? Transferden sonra kaynağın kendisi de stok sıkıntısına girmemeli.' },
              { step: '3', color: '#1d4ed8', title: 'Alıcı DOS kontrolü (asıl tetikleyici)', body: 'Alıcı mağazanın DOS\'u maxReceiverDOS\'tan küçük mü? Değilse zaten stoğu yeterli, transfer gerekmez.' },
              { step: '4', color: '#7c3aed', title: 'Ölü stok filtresi', body: 'Ürünün STR\'i deadStockStrThreshold\'un üzerinde mi? Altındaysa kimse bu ürünü almıyor demektir — başka mağazaya göndermek anlamsız.' },
              { step: '5', color: '#059669', title: 'Miktar hesabı', body: 'DOS dengesi formülüyle hesaplanan miktar > 0 mı? Sıfır veya negatif çıkıyorsa öneri oluşturulmaz.' },
            ].map((item) => (
              <div key={item.step} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', background: item.color,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, marginTop: 1,
                }}>
                  {item.step}
                </div>
                <div>
                  <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)' }}>{item.title}</p>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <CalloutBox icon="🏭" title="Özel durum: Öncelikli kaynaklar (depo/online)" color="#059669">
            Merkez Depo veya Online gibi öncelikli kaynaklar için adım 2 ve 4 atlanır. Bu kanallar dağıtım merkezi gibi davranır; kendi satışları olmadığından STR = 0 ve DOS = ∞ görünebilir. Sisteme bu kanalları "her zaman verebilir" olarak tanıtmak gerekir.
          </CalloutBox>
        </Section>

        {/* ─── 4. Miktar Hesabı ─── */}
        <Section title="Transfer Miktarı Nasıl Hesaplanır?" subtitle="DOS Dengesi formülü">
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 12, lineHeight: 1.7 }}>
            Koşullar sağlandıktan sonra "kaç adet göndereceğiz?" sorusu şu şekilde yanıtlanır:
          </p>
          <FormulaBlock>
            {'// 1. Teorik miktar: iki mağaza arasında DOS\'u dengele'}{'\n'}
            toplam_hız = kaynak_hız + alıcı_hız{'\n'}
            denge_DOS  = (kaynak_stok + alıcı_stok) / toplam_hız{'\n'}
            teorik     = denge_DOS × alıcı_hız − alıcı_stok{'\n\n'}
            {'// 2. Kaynak koruması: minSourceDOS günlük stok ve minInventory adet bırak'}{'\n'}
            koruma_üst  = kaynak_stok − ⌈minSourceDOS × kaynak_hız⌉{'\n'}
            sabit_taban = kaynak_stok − minInventory{'\n'}
            kullanılabilir = min(koruma_üst, sabit_taban){'\n\n'}
            {'// 3. Sınırları uygula'}{'\n'}
            miktar = min(teorik, kullanılabilir, maxTransfer){'\n'}
            miktar = max(0, miktar)  {'// negatif olamaz'}
          </FormulaBlock>
          <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', margin: '12px 0 0', lineHeight: 1.6 }}>
            Hangi kural miktarı kısıtladıysa <strong>appliedFilter</strong> alanı bunu belirtir:
            "Teorik (DOS dengesi)", "Kaynak koruma (min 14g)" veya "Maks. 5 adet" gibi.
          </p>
        </Section>

        {/* ─── 5. Parametreler ─── */}
        <Section title="Strateji Parametreleri" subtitle="Her parametrenin rolü ve etkisi">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PARAMS.map((p) => (
              <div key={p.key} style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderLeft: `3px solid ${p.color}`,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>{p.label}</span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, color: p.color,
                    background: `${p.color}14`, padding: '2px 8px', borderRadius: 99,
                    border: `1px solid ${p.color}30`,
                  }}>{p.role}</span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>{p.desc}</p>
                <div style={{
                  fontSize: '0.78rem', color: 'var(--ink-soft)',
                  background: 'var(--surface-up)', borderRadius: 6,
                  padding: '6px 10px', fontFamily: 'monospace',
                }}>
                  Örnek: {p.example}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── 6. Preset Karşılaştırma ─── */}
        <Section title="Strateji Presetleri" subtitle="Üç hazır strateji ve değerleri">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {STRATEGIES.map((s) => (
              <div key={s.name} style={{
                background: s.bg,
                border: `1px solid ${s.color}30`,
                borderTop: `3px solid ${s.color}`,
                borderRadius: 10,
                padding: '16px',
              }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.95rem', color: s.color }}>{s.name}</p>
                <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{s.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    ['Min. Kaynak DOS', `${s.minSourceDOS} gün`],
                    ['Max. Alıcı DOS', `${s.maxReceiverDOS} gün`],
                    ['Min. Stok', `${s.minInventory} adet`],
                    ['Max. Transfer', s.maxTransfer],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
                      <strong style={{ color: 'var(--ink)' }}>{val}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <CalloutBox icon="✏️" title="Custom strateji" color="#7c3aed" >
            Analysis ekranında Custom kolonunu seçerek parametreleri özgürce ayarlayabilirsiniz. Başlangıç noktası olarak Kontrollü değerleri yüklenir.
          </CalloutBox>
        </Section>

        {/* ─── 7. Stok Durumu ─── */}
        <Section title="Alıcı Stok Durumu Kategorileri" subtitle="Transfer önerilerinde görünen stockStatus değerleri">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {STATUS_LEVELS.map((s) => (
              <div key={s.label} style={{
                background: s.bg,
                border: `1px solid ${s.color}25`,
                borderRadius: 10,
                padding: '14px',
              }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '0.85rem', color: s.color }}>{s.label}</p>
                <p style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-soft)' }}>{s.range}</p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            Eşikler: ≤3g → KRİTİK &nbsp;|&nbsp; ≤7g → DÜŞÜK &nbsp;|&nbsp; ≤14g → NORMAL &nbsp;|&nbsp; {'>'} 14g → YÜKSEK
          </p>
        </Section>

        {/* ─── 8. Transfer Tipleri ─── */}
        <Section title="Transfer Tipleri" subtitle="Üç farklı analiz modu">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TRANSFER_TYPES.map((t) => (
              <div key={t.name} style={{
                display: 'flex', gap: 16,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0, lineHeight: 1.3 }}>{t.icon}</span>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>{t.name}</p>
                  <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>{t.desc}</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--accent-text)', fontWeight: 500 }}>Ne zaman: {t.when}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
