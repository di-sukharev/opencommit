import en from '../i18n/en.json' assert { type: 'json' };
import de from '../i18n/de.json' assert { type: 'json' };
import fr from '../i18n/fr.json' assert { type: 'json' };
import it from '../i18n/it.json' assert { type: 'json' };
import ko from '../i18n/ko.json' assert { type: 'json' };
import zh_CN from '../i18n/zh_CN.json' assert { type: 'json' };
import zh_TW from '../i18n/zh_TW.json' assert { type: 'json' };
import ja from '../i18n/ja.json' assert { type: 'json' };

export enum I18nLocals {
  'en' = 'en',
  'zh_CN' = 'zh_CN',
  'zh_TW' = 'zh_TW',
  'ja' = 'ja',
  'de' = 'de',
  'fr' = 'fr',
  'it' = 'it',
  'ko' = 'ko'
};

export const i18n = {
  en,
  zh_CN,
  zh_TW,
  ja,
  de,
  fr,
  it,
  ko,
};

export const I18N_CONFIG_ALIAS: { [key: string]: string[] } = {
  zh_CN: ['zh_CN', '简体中文', '中文', '简体'],
  zh_TW: ['zh_TW', '繁體中文', '繁體'],
  ja: ['ja', 'Japanese', 'にほんご'],
  ko: ['ko', 'Korean', '한국어'],
  de: ['de', 'German' ,'Deutsch'],
  fr: ['fr', 'French', 'française'],
  it: ['it', 'Italian', 'italiano'],
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
