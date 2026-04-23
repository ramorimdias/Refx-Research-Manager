import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const APP_ID = '6d41aa7b-5778-4a06-9df2-23f8d6e9465a'
const VERSION = '1.0.0.0'

const configs = {
  development: {
    output: 'manifest.xml',
    baseUrl: 'https://localhost:5174',
    supportUrl: 'https://localhost:5174',
  },
  production: {
    output: 'manifest.production.xml',
    baseUrl: 'https://word.667764.xyz',
    supportUrl: 'https://667764.xyz/refx/support',
  },
}

function manifest({ baseUrl, supportUrl }) {
  const sourceUrl = `${baseUrl}/index.html`
  const icon16 = `${baseUrl}/assets/icon-16.png`
  const icon32 = `${baseUrl}/assets/icon-32.png`
  const icon64 = `${baseUrl}/assets/icon-64.png`
  const icon80 = `${baseUrl}/assets/icon-80.png`

  return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xsi:type="TaskPaneApp">
  <Id>${APP_ID}</Id>
  <Version>${VERSION}</Version>
  <ProviderName>Refx</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="Refx"/>
  <Description DefaultValue="Insert Refx citations and rebuild numeric bibliographies."/>
  <IconUrl DefaultValue="${icon32}"/>
  <HighResolutionIconUrl DefaultValue="${icon64}"/>
  <SupportUrl DefaultValue="${supportUrl}"/>
  <AppDomains>
    <AppDomain>${baseUrl}</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Document"/>
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="WordApi" MinVersion="1.1"/>
    </Sets>
  </Requirements>
  <DefaultSettings>
    <SourceLocation DefaultValue="${sourceUrl}"/>
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>

  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Document">
        <DesktopFormFactor>
          <FunctionFile resid="Taskpane.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabReferences">
              <Group id="Refx.Group">
                <Label resid="Commands.GroupLabel"/>
                <Icon>
                  <bt:Image size="16" resid="Icon.16x16"/>
                  <bt:Image size="32" resid="Icon.32x32"/>
                  <bt:Image size="80" resid="Icon.80x80"/>
                </Icon>
                <Control xsi:type="Button" id="Refx.OpenPane">
                  <Label resid="Commands.OpenPaneLabel"/>
                  <Supertip>
                    <Title resid="Commands.OpenPaneLabel"/>
                    <Description resid="Commands.OpenPaneDescription"/>
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="Icon.16x16"/>
                    <bt:Image size="32" resid="Icon.32x32"/>
                    <bt:Image size="80" resid="Icon.80x80"/>
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>ButtonId1</TaskpaneId>
                    <SourceLocation resid="Taskpane.Url"/>
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="Icon.16x16" DefaultValue="${icon16}"/>
        <bt:Image id="Icon.32x32" DefaultValue="${icon32}"/>
        <bt:Image id="Icon.80x80" DefaultValue="${icon80}"/>
      </bt:Images>
      <bt:Urls>
        <bt:Url id="Taskpane.Url" DefaultValue="${sourceUrl}"/>
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="Commands.GroupLabel" DefaultValue="Refx"/>
        <bt:String id="Commands.OpenPaneLabel" DefaultValue="Refx"/>
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="Commands.OpenPaneDescription" DefaultValue="Open the Refx citation task pane."/>
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`
}

for (const config of Object.values(configs)) {
  writeFileSync(resolve(root, config.output), manifest(config), 'utf8')
  console.log(`Generated ${config.output}`)
}
