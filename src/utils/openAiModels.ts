const models = [
  'gpt-3.5-turbo',
  'text-davinci-003',
  'text-davinci-002',
  'code-davinci-002',
  'gpt-4'
];

export const openAiModel = (value: string): boolean | string => {
  if (models.includes(value)) return value;
  return false;
};
