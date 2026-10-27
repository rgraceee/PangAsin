// WHAT: "About the ASIN Center" + "Our Mandate" — ang pangalawang block ng
//       public page.
// WHY: Ang bisitante ay kailangang malaman kung sino ang nag-publish ng datos
//      at ano ang role ng ASIN Center bago tumingin sa mga numero.
import React from 'react';
import { BarChart3, Database, FlaskConical, Landmark } from 'lucide-react';

// WHAT: Ang apat na mandate pillars ng ASIN Center.
// WHY: Isang listahan — madaling basahin, at parehong visual weight para sa
//      bawat isa. Ang icon ay nag-iisa ang pagkakaiba ng bawat pillar.
const MANDATE = [
  {
    icon: Database,
    tone: 'ocean',
    title: 'Data and monitoring',
    body:
      'Collect, validate and publish salt production records from the salt-producing municipalities of Pangasinan so every figure has a traceable source.',
  },
  {
    icon: FlaskConical,
    tone: 'green',
    title: 'Research and innovation',
    body:
      'Support studies on solar evaporation and cooked salt production to raise yield, improve quality, and strengthen the industry against climate shocks.',
  },
  {
    icon: BarChart3,
    tone: 'gold',
    title: 'Planning and decision support',
    body:
      'Turn production history into forecasts, targets and supply-demand benchmarks that planners, producers and investors can act on.',
  },
  {
    icon: Landmark,
    tone: 'navy',
    title: 'Policy support under RA 11985',
    body:
      'Provide the evidence base for implementing the Philippine Salt Industry Development Act across the salt-producing areas of the country.',
  },
];

export default function PublicAbout() {
  return (
    <section className="public-about" aria-labelledby="public-about-title">
      <div className="public-about-main">
        <div className="public-about-eyebrow">About the ASIN Center</div>
        <h2 className="public-about-title" id="public-about-title">
          Accelerating the Philippine Salt Industry
        </h2>
        <p className="public-about-body">
          The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State University
          supports the Philippine salt industry through research, innovation and data-driven planning
          under RA 11985. It is the single point where production records from the municipal encoders
          are validated, benchmarked against demand, and turned into forecasts and targets.
        </p>
        <p className="public-about-body">
          This dashboard is the Center&rsquo;s public window for municipality
          production and salt-bed data, presented with the demand benchmarks that give them context.
          This dataset is distinct from approved barangay submissions, which remain preserved in the
          operational system. The January–September 2026 monthly series is generated from workbook
          synthesis and is not independently observed.
        </p>
      </div>

      <div className="public-about-mandate">
        <div className="public-about-eyebrow">Our Mandate</div>
        <ul className="public-mandate-list">
          {MANDATE.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="public-mandate-item">
                <span className={`public-mandate-icon public-mandate-icon--${item.tone}`}>
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <div className="public-mandate-text">
                  <h3 className="public-mandate-title">{item.title}</h3>
                  <p className="public-mandate-body">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
