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
    body: 'Studies and develops better methods for salt production.',
  },
  {
    icon: Microscope,
    tone: 'ocean',
    title: 'Analytic Services and Testing',
    body: 'Provides laboratory testing and analysis to support salt quality and innovation.',
  },
  {
    icon: BarChart3,
    tone: 'gold',
    title: 'Data Analytics and Information Technology',
    body: 'Supports data-driven work and digital tools for the salt sector.',
  },
  {
    icon: Handshake,
    tone: 'navy',
    title: 'Administration, Finance, and Linkages',
    body: 'Manages operations and partnerships with universities, agencies, and industry.',
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
          The Accelerating Salt Research and Innovation (ASIN) Center is a salt research and innovation
          hub at Pangasinan State University, based at the PSU Binmaley Campus. Supported by the
          Department of Science and Technology through its NICER Program, it works to modernize
          traditional cooked and solar salt production so that it becomes more efficient, sustainable,
          and scalable. The Center aims to equip local salt producers with practical tools and to help
          the country move toward salt self-sufficiency while strengthening the local economy.
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
