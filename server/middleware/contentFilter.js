// Server-side content filtering (same as frontend regex)

// Phone numbers (10-digit, various formats)
const phoneRegex = /\b(?:\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})\b/gi;

// Email addresses
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Social media patterns
const socialRegexes = [
  /@[\w.]+\s*(?:instagram|ig|insta|twitter|x\.com|facebook|fb|linkedin|snapchat|tiktok|telegram|whatsapp|wa)/gi,
  /(?:instagram|twitter|x)\.com\/[\w.]+/gi,
  /t(?:elegram)?\.me\/[\w.]+/gi,
  /wa\.me\/[\d]+/gi,
  /facebook\.com\/[\w.]+/gi,
  /linkedin\.com\/[\w.]+/gi,
  /snapchat\.com\/add\/[\w.]+/gi,
  /tiktok\.com\/@?[\w.]+/gi,
  /@[a-zA-Z0-9_]{3,}/gi // General @username
];

function contentFilter(text) {
  if (!text) return false;

  const content = text.toLowerCase();

  // Check phone
  if (phoneRegex.test(text)) return true;

  // Check email
  if (emailRegex.test(text)) return true;

  // Check social
  for (const regex of socialRegexes) {
    if (regex.test(text)) return true;
  }

  return false;
}

module.exports = { contentFilter };

