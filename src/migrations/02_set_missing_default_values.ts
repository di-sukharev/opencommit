import {
  ConfigType,
  DEFAULT_CONFIG,
  getGlobalConfig,
  setConfig
} from '../commands/config';

export default function () {
  const setDefaultConfigValues = (config: ConfigType) => {
    const entriesToSet: [key: string, value: string | boolean | number][] = [];
    for (const entry of Object.entries(DEFAULT_CONFIG)) {
      const [key, _value] = entry;
      if (config[key] === 'undefined' || config[key] === undefined)
        entriesToSet.push(entry);
    }

    if (entriesToSet.length > 0) setConfig(entriesToSet);
    console.log(entriesToSet);
  };

  setDefaultConfigValues(getGlobalConfig());
}
