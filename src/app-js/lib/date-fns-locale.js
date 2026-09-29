import { enUS, es, it, pl, pt, ptBR, ru, uk, de, fr, nl, sk, el, hi, ja } from 'date-fns/locale';
import { resolveSupportedLang } from './i18n.js';
const DATE_FNS_LOCALE = {
    en: enUS,
    'pt-BR': ptBR,
    'pt-PT': pt,
    es,
    pl,
    it,
    ru,
    uk,
    de,
    fr,
    nl,
    sk,
    el,
    hi,
    ja,
};
export function resolveDateFnsLocale(language) {
    return DATE_FNS_LOCALE[resolveSupportedLang(language)];
}
