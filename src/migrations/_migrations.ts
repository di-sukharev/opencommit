import migration00 from './00_use_single_api_key_and_url';

export const migrations = [
  {
    name: '00_use_single_api_key_and_url',
    run: migration00
  }
];
