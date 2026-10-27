'use client'

import * as React from 'react'
import { Eraser } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const t = useT()
  const canvas = React.useRef<HTMLCanvasElement | null>(null)
  const drawing = React.useRef(false)
  const inked = React.useRef(false)
  const [empty, setEmpty] = React.useState(true)

  React.useEffect(() => {
    const element = canvas.current
    if (!element) return
    const ratio = window.devicePixelRatio || 1
    const width = element.clientWidth
    const height = element.clientHeight
    element.width = width * ratio
    element.height = height * ratio
    const context = element.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.lineWidth = 2.2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#111827'
  }, [])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    const { x, y } = point(event)
    context.beginPath()
    context.moveTo(x, y)
  }

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    const { x, y } = point(event)
    context.lineTo(x, y)
    context.stroke()
    if (!inked.current) {
      inked.current = true
      setEmpty(false)
    }
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    if (canvas.current && inked.current) onChange(canvas.current.toDataURL('image/png'))
  }

  const clear = () => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, element.width, element.height)
    context.restore()
    inked.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvas}
        aria-label={t('dermat_orders.approval.signHere', 'Sign here')}
        className="h-40 w-full touch-none rounded-md border border-dashed border-input bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{empty ? t('dermat_orders.approval.signHint', 'Sign with your finger or mouse') : t('dermat_orders.approval.signed', 'Signed')}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <Eraser className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {t('dermat_orders.approval.clear', 'Clear')}
        </Button>
      </div>
    </div>
  )
}

export default SignaturePad
