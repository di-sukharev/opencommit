const models = [
  'gpt-3.5-turbo',
  'gpt-4'
];

export const openAiModel = (value: string): boolean | string => {
  if (models.includes(value)) return value;
  return false;
};
