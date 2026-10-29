// WHAT: Client-side preview ng encoder email na bubuoin ng backend.
// WHY: Makita agad ng admin ang exact address bago mag-save, para hindi na
//      magulat pagkatapos ng create; pareho ang slug rules sa municipality_service.
export const ENCODER_EMAIL_DOMAIN = 'pangasin.gov.ph';

// WHAT: Parehong slug rule sa backend: drop "City of " / " City", lowercase,
//       at alisin ang lahat maliban sa letters at digits.
// WHY: Kung iba ang preview sa server, makakalito sa admin.
export function slugifyMunicipalityName(name) {
  let value = String(name || '').trim().toLowerCase();
  if (value.startsWith('city of ')) value = value.slice('city of '.length);
  if (value.endsWith(' city')) value = value.slice(0, -' city'.length);
  return value.replace(/[^a-z0-9]+/g, '');
}

export function previewEncoderEmail(name) {
  const slug = slugifyMunicipalityName(name);
  return slug ? `${slug}.encoder@${ENCODER_EMAIL_DOMAIN}` : '';
}
