import cs from '../i18n/cs.json';
import de from '../i18n/de.json';
import en from '../i18n/en.json';
import es_ES from '../i18n/es_ES.json';
import fr from '../i18n/fr.json';
import id_ID from '../i18n/id_ID.json';
import it from '../i18n/it.json';
import ja from '../i18n/ja.json';
import ko from '../i18n/ko.json';
import nl from '../i18n/nl.json';
import pl from '../i18n/pl.json';
import pt_br from '../i18n/pt_br.json';
import ru from '../i18n/ru.json';
import sv from '../i18n/sv.json';
import th from '../i18n/th.json';
import tr from '../i18n/tr.json';
import vi_VN from '../i18n/vi_VN.json';
import zh_CN from '../i18n/zh_CN.json';
import zh_TW from '../i18n/zh_TW.json';

export enum I18nLocals {
  'en' = 'en',
  'zh_CN' = 'zh_CN',
  'zh_TW' = 'zh_TW',
  'ja' = 'ja',
  'cs' = 'cs',
  'de' = 'de',
  'fr' = 'fr',
  'nl' = 'nl',
  'it' = 'it',
  'ko' = 'ko',
  'pt_br' = 'pt_br',
  'es_ES' = 'es_ES',
  'sv' = 'sv',
  'ru' = 'ru',
  'id_ID' = 'id_ID',
  'pl' = 'pl',
  'tr' = 'tr',
  'th' = 'th'
}

export const i18n = {
  en,
  zh_CN,
  zh_TW,
  ja,
  cs,
  de,
  fr,
  it,
  ko,
  pt_br,
  vi_VN,
  es_ES,
  sv,
  id_ID,
  nl,
  ru,
  pl,
  tr,
  th
};

export const I18N_CONFIG_ALIAS: { [key: string]: string[] } = {
  zh_CN: ['zh_CN', '简体中文', '中文', '简体'],
  zh_TW: ['zh_TW', '繁體中文', '繁體'],
  ja: ['ja', 'Japanese', 'にほんご'],
  ko: ['ko', 'Korean', '한국어'],
  cs: ['cs', 'Czech', 'česky'],
  de: ['de', 'German', 'Deutsch'],
  fr: ['fr', 'French', 'française'],
  it: ['it', 'Italian', 'italiano'],
  nl: ['nl', 'Dutch', 'Nederlands'],
  pt_br: ['pt_br', 'Portuguese', 'português'],
  vi_VN: ['vi_VN', 'Vietnamese', 'tiếng Việt'],
  en: ['en', 'English', 'english'],
  es_ES: ['es_ES', 'Spanish', 'español'],
  sv: ['sv', 'Swedish', 'Svenska'],
  ru: ['ru', 'Russian', 'русский'],
  id_ID: ['id_ID', 'Bahasa', 'bahasa'],
  pl: ['pl', 'Polish', 'Polski'],
  tr: ['tr', 'Turkish', 'Turkish'],
  th: ['th', 'Thai', 'ไทย']
};

export function getI18nLocal(value: string): string | boolean {
  for (const key in I18N_CONFIG_ALIAS) {
    const aliases = I18N_CONFIG_ALIAS[key];
    if (aliases.includes(value)) {
      return key;
    }
  }
  return false;
}
