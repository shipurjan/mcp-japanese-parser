const config = {
  '*.ts': () => 'tsc --noEmit --pretty --skipLibCheck --diagnostics',
  '*': ['eslint --cache --fix', 'prettier --cache --write'],
}

export default config
