const RULES = Object.freeze({
  instagram: { re: /^[A-Za-z0-9._]{1,30}$/, base: 'https://www.instagram.com/' },
  youtube: { re: /^@?[A-Za-z0-9._-]{1,100}$/, base: 'https://www.youtube.com/' },
  facebook: { re: /^[A-Za-z0-9._-]{1,100}$/, base: 'https://www.facebook.com/' },
  tiktok: { re: /^[A-Za-z0-9._]{1,30}$/, base: 'https://www.tiktok.com/@' },
  linkedin: { re: /^[A-Za-z0-9._-]{1,100}$/, base: 'https://www.linkedin.com/in/' },
  x: { re: /^[A-Za-z0-9._]{1,30}$/, base: 'https://x.com/' },
})

export function socialProfileUrl(platform, handle) {
  const rule = RULES[platform]
  const clean = typeof handle === 'string' ? handle.replace(/^@/, '') : ''
  return rule && rule.re.test(handle) && !/[/?#]|https?:|www\./i.test(handle)
    ? `${rule.base}${platform === 'youtube' && handle.startsWith('@') ? '@' : ''}${encodeURIComponent(clean)}`
    : null
}
