import en from '../i18n/en.json' assert { type: 'json' };
import de from '../i18n/de.json' assert { type: 'json' };
import fr from '../i18n/fr.json' assert { type: 'json' };
import it from '../i18n/it.json' assert { type: 'json' };
import ko from '../i18n/ko.json' assert { type: 'json' };
import zh_CN from '../i18n/zh_CN.json' assert { type: 'json' };
import zh_TW from '../i18n/zh_TW.json' assert { type: 'json' };
import ja from '../i18n/ja.json' assert { type: 'json' };
import pt_br from '../i18n/pt_br.json' assert { type: 'json' };
import vi_VN from '../i18n/vi_VN.json' assert { type: 'json' };
import es_ES from '../i18n/es_ES.json' assert { type: 'json' };
import sv from '../i18n/sv.json' assert { type: 'json' };
import nl from '../i18n/nl.json' assert { type: 'json' };
import ru from '../i18n/ru.json' assert { type: 'json' };
import id_ID from '../i18n/id_ID.json' assert { type: 'json' };
import pl from '../i18n/pl.json' assert { type: 'json' };
import th from '../i18n/th.json' assert { type: 'json' };

export enum I18nLocals {
  'en' = 'en',
  'zh_CN' = 'zh_CN',
  'zh_TW' = 'zh_TW',
  'ja' = 'ja',
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
  'th' = 'th',
}

export const i18n = {
  en,
  zh_CN,
  zh_TW,
  ja,
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
  th
};

export const I18N_CONFIG_ALIAS: { [key: string]: string[] } = {
  zh_CN: ['zh_CN', '简体中文', '中文', '简体'],
  zh_TW: ['zh_TW', '繁體中文', '繁體'],
  ja: ['ja', 'Japanese', 'にほんご'],
  ko: ['ko', 'Korean', '한국어'],
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
