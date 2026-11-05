// WHAT: "About the ASIN Center" + "What the Center Does" — ang pangalawang
//       block ng public page.
// WHY: Ang bisitante ay kailangang malaman kung sino ang nag-publish ng datos
//      at ano ang role ng ASIN Center bago tumingin sa mga numero.
import React from 'react';
import { BarChart3, FlaskConical, Handshake, Microscope } from 'lucide-react';

// WHAT: Ang apat na function ng ASIN Center.
// WHY: Isang listahan — madaling basahin, at parehong visual weight para sa
//      bawat isa. Ang icon ay nag-iisa ang pagkakaiba ng bawat function.
const MANDATE = [
  {
    icon: FlaskConical,
    tone: 'green',
    title: 'Research and Development',
    description: 'Modernizing cooked and solar salt production through applied research, pilot trials, and technology transfer to local producers.',
  },
  {
    icon: Microscope,
    tone: 'ocean',
    title: 'Analytic Services and Testing',
    description: 'Laboratory analysis of salt quality, iodine content, and purity standards to support producer certification and market compliance.',
  },
  {
    icon: BarChart3,
    tone: 'gold',
    title: 'Data Analytics and Information Technology',
    description: 'Provincial salt production dashboard, forecasting, and data systems that inform policy, investment, and industry planning.',
  },
  {
    icon: Handshake,
    tone: 'navy',
    title: 'Administration, Finance, and Linkages',
    description: 'Program management, funding coordination, and partnerships with DOST, LGUs, and salt producer cooperatives across Pangasinan.',
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
          The Accelerating Salt Research and Innovation (ASIN) Center is a salt research and innovation hub at Pangasinan State University, based at the PSU Binmaley Campus. Supported by the Department of Science and Technology through its NICER Program, it works to modernize traditional cooked and solar salt production so that it becomes more efficient, sustainable, and scalable.
        </p>
        <p className="public-about-body">
          The Center aims to equip local salt producers with practical tools and to help the country move toward salt self-sufficiency while strengthening the local economy.
        </p>
      </div>

      <div className="public-about-mandate">
        <div className="public-about-eyebrow">What the Center Does</div>
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
                  {item.description ? (
                    <p className="public-mandate-body">{item.description}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
