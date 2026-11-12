import { useEffect, useRef, useState } from 'react'
import WebViewer from '@pdftron/webviewer'
import './App.css'

const annotationsUrl = '/api/documents/demo/annotations'

export default function App() {
  const viewerElement = useRef(null)
  const viewerInstance = useRef(null)
  const initialized = useRef(false)

  const [status, setStatus] = useState('Starting document viewer…')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function startViewer() {
      try {
        const instance = await WebViewer(
          {
            path: '/webviewer',
            licenseKey: import.meta.env.VITE_APRYSE_LICENSE_KEY,
          },
          viewerElement.current,
        )

        viewerInstance.current = instance

        const { documentViewer, annotationManager } = instance.Core

        // Prevent editing until the saved review has been restored.
        annotationManager.enableReadOnlyMode()

        documentViewer.addEventListener('documentLoaded', async () => {
          try {
            setReady(false)
            setError('')
            setStatus('Loading saved review…')

            await documentViewer.getAnnotationsLoadedPromise()

            const response = await fetch(annotationsUrl)

            if (!response.ok) {
              throw new Error(
                `Could not load the review: HTTP ${response.status}`,
              )
            }

            const savedReview = await response.json()

            if (typeof savedReview.xfdf !== 'string') {
              throw new Error('The API returned an unexpected response.')
            }

            if (savedReview.xfdf) {
              await annotationManager.importAnnotations(savedReview.xfdf)
            }

            annotationManager.disableReadOnlyMode()
            setReady(true)
            setStatus('Ready. Add annotations, then click Save review.')
          } catch (err) {
            console.error('Review loading failed:', err)
            setError(err.message)
            setStatus('Review could not be loaded. Check the API and refresh.')
          }
        })

        instance.UI.loadDocument('/sample-contract.pdf')
      } catch (err) {
        console.error('Viewer initialization failed:', err)
        setError(err.message)
        setStatus('Unable to start the viewer.')
      }
    }

    startViewer()
  }, [])

  async function saveReview() {
    if (!viewerInstance.current || !ready || saving) return

    const { annotationManager } = viewerInstance.current.Core

    setSaving(true)
    setError('')
    setStatus('Saving review…')

    // Keep the annotations stable while exporting and saving them.
    annotationManager.enableReadOnlyMode()

    try {
      const xfdf = await annotationManager.exportAnnotations()

      const response = await fetch(annotationsUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ xfdf }),
      })

      if (!response.ok) {
        throw new Error(
          `Could not save the review: HTTP ${response.status}`,
        )
      }

      setStatus('Review saved. Save again after making further changes.')
    } catch (err) {
      console.error('Review saving failed:', err)
      setError(err.message)
      setStatus('Save failed. Your current annotations remain in the viewer.')
    } finally {
      annotationManager.disableReadOnlyMode()
      setSaving(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Contract Review Demo</h1>
        <p>Built with Apryse WebViewer and React</p>
      </header>

      <div className="review-actions">
        <button
          type="button"
          onClick={saveReview}
          disabled={!ready || saving}
          className="save-button"
        >
          {saving ? 'Saving…' : 'Save review'}
        </button>

        <p className="review-status" role="status">
          {status}
        </p>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <main
        ref={viewerElement}
        className="document-viewer"
        aria-label="Document viewer"
      />
    </div>
  )
}