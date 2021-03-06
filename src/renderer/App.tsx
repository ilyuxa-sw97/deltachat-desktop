import React, { useState, useEffect } from 'react'
import { SettingsContext } from './contexts'
import ScreenController from './ScreenController'
import { addLocaleData, IntlProvider } from 'react-intl'
import enLocaleData from 'react-intl/locale-data/en'
const { remote } = window.electron_functions
import { sendToBackend, ipcBackend, startBackendLogging } from './ipc'
import attachKeybindingsListener from './keybindings'
import { ExtendedApp, AppState } from '../shared/shared-types'

import { translate, LocaleData } from '../shared/localize'
import { getLogger } from '../shared/logger'
import { DeltaBackend } from './delta-remote'
import { ThemeManager } from './ThemeManager'

const log = getLogger('renderer/App')
import moment from 'moment'

addLocaleData(enLocaleData)

attachKeybindingsListener()

// This export is just used to activate the theme manager for now
export const theme_manager = ThemeManager

export default function App(props: any) {
  const [state, setState] = useState<AppState>(
    (remote.app as ExtendedApp).state
  )
  const [localeData, setLocaleData] = useState<LocaleData | null>(null)

  useEffect(() => {
    sendToBackend('ipcReady')
    window.addEventListener('keydown', function(ev: KeyboardEvent) {
      if (ev.code === 'KeyA' && (ev.metaKey || ev.ctrlKey)) {
        let stop = true
        if (
          (ev.target as HTMLElement).localName === 'textarea' ||
          (ev.target as HTMLElement).localName === 'input'
        ) {
          stop = false
        } else {
          // KeyboardEvent ev.path does ONLY exist in CHROMIUM
          const invokePath: HTMLElement[] = (ev as any).path
          for (let index = 0; index < invokePath.length; index++) {
            const element: HTMLElement = invokePath[index]
            if (
              element.localName === 'textarea' ||
              element.localName === 'input'
            )
              stop = false
          }
        }
        if (stop) {
          ev.stopPropagation()
          ev.preventDefault()
        }
      }
    })
  }, [])

  useEffect(() => {
    startBackendLogging()
    setupLocaleData(state.saved.locale)
  }, [])
  const onRender = (e: any, state: AppState) => {
    log.debug('onRenderer')
    setState(state)
  }
  useEffect(() => {
    ipcBackend.on('render', onRender)
    return () => {
      ipcBackend.removeListener('render', onRender)
    }
  }, [state])

  async function setupLocaleData(locale: string) {
    moment.locale(locale)
    const localeData: LocaleData = await DeltaBackend.call(
      'extras.getLocaleData',
      locale
    )
    window.localeData = localeData
    window.translate = translate(localeData.messages)
    setLocaleData(localeData)
  }

  const onChooseLanguage = async (e: any, locale: string) => {
    await setupLocaleData(locale)
    sendToBackend('chooseLanguage', locale)
  }
  useEffect(() => {
    ipcBackend.on('chooseLanguage', onChooseLanguage)
    return () => {
      ipcBackend.removeListener('chooseLanguage', onChooseLanguage)
    }
  }, [localeData])

  if (!localeData) return null
  return (
    <SettingsContext.Provider value={state.saved}>
      <IntlProvider locale={localeData.locale}>
        <ScreenController logins={state.logins} deltachat={state.deltachat} />
      </IntlProvider>
    </SettingsContext.Provider>
  )
}
