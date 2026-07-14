export interface EnvironmentVariableDefinition {
  name: string;
  required: boolean;
  secret?: boolean;
  description: string;
}

export const commonEnvironmentVariables: EnvironmentVariableDefinition[] = [
  {
    name: 'NODE_ENV',
    required: true,
    description: 'Runtime environment name.',
  },
  {
    name: 'API_CONSOLE_PORT',
    required: true,
    description: 'Local API Console HTTP port.',
  },
];
