import { useEffect, useRef, useState } from 'react'
import WebViewer from '@pdftron/webviewer'
import './App.css'

export default function App() {
  const viewerElement = useRef(null)
  const initialized = useRef(false)
  const [status, setStatus] = useState('Starting document viewer…')
  const [error, setError] = useState('')

  useEffect(() => {
    // Initialize once, including during React's development checks.
    if (initialized.current) return
    initialized.current = true

    const licenseKey = import.meta.env.VITE_APRYSE_LICENSE_KEY

    if (!licenseKey) {
      setError('Add your Apryse trial key to .env.local and restart Vite.')
      setStatus('Configuration needed')
      return
    }

    async function startViewer() {
      try {
        const instance = await WebViewer(
          {
            path: '/webviewer',
            licenseKey,
          },
          viewerElement.current,
        )

        instance.Core.documentViewer.addEventListener(
          'documentLoaded',
          () => {
            setStatus('Document ready — try highlighting text or adding a comment.')
          },
        )

        setStatus('Loading sample contract…')
        instance.UI.loadDocument('/sample-contract.pdf')
      } catch (err) {
        console.error('Viewer initialization failed:', err)
        setError('The viewer could not start. Check the browser console for details.')
        setStatus('Unable to start viewer')
      }
    }

    startViewer()
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Contract Review Demo</h1>
        <p>Built with Apryse WebViewer and React</p>
      </header>

      <p className="status" role="status">{status}</p>

      {error && <p className="error" role="alert">{error}</p>}

      <main
        ref={viewerElement}
        className="document-viewer"
        aria-label="Document viewer"
      />
    </div>
  )
}