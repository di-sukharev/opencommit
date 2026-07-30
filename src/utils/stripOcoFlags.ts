interface OcoFlagSpec {
  names: readonly string[];
  consumesNextToken: boolean;
}

const OCO_FLAG_SPECS: readonly OcoFlagSpec[] = [
  {
    names: ['-c', '--context'],
    consumesNextToken: true
  },
  {
    names: ['-y', '--yes', '--fgm'],
    consumesNextToken: false
  }
];

export function stripOcoFlags(argv: readonly string[]): string[] {
  const forwardedArgs: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    const exactFlag = OCO_FLAG_SPECS.find((spec) =>
      spec.names.includes(argument)
    );

    if (exactFlag) {
      if (exactFlag.consumesNextToken) index++;
      continue;
    }

    const isEqualsForm = OCO_FLAG_SPECS.some((spec) =>
      spec.names.some((name) => argument.startsWith(`${name}=`))
    );
    if (isEqualsForm) continue;

    forwardedArgs.push(argument);
  }

  return forwardedArgs;
}
