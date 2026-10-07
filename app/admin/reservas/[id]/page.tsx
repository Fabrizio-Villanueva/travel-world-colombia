import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminSession } from '@/lib/admin/guard'
import { cargarReserva } from '../actions'
import { cargarEstadoDocumentos } from './documentos-actions'
import { Wizard } from './Wizard'
import { ContratoPanel } from './ContratoPanel'
import { DocumentosTab } from './DocumentosTab'
import { PasoFlujo } from './PasoFlujo'
import { estadoContrato } from './contrato-actions'

export const metadata: Metadata = { title: 'Generador de Contratos · Panel' }
export const dynamic = 'force-dynamic'

export default async function ReservaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol === 'lector') redirect('/admin')

  const { id } = await params
  const [reserva, documentos, contrato] = await Promise.all([
    cargarReserva(id),
    cargarEstadoDocumentos(id),
    estadoContrato(id),
  ])

  const sd = documentos.solicitud
  const chipDocumentos = !sd
    ? { texto: 'Sin enviar', fondo: '#F4F7FB', color: '#6B7A90' }
    : sd.estado === 'completa'
      ? { texto: 'Documentos completos', fondo: '#ECFDF5', color: '#047857' }
      : sd.estado === 'revocada'
        ? { texto: 'Enlace desactivado', fondo: '#FFF1F2', color: '#BE123C' }
        : {
            texto: documentos.progreso
              ? `En curso · ${documentos.progreso.confirmados}/${documentos.progreso.requeridos}`
              : 'Enlace activo',
            fondo: '#EDF3FC',
            color: '#2957A4',
          }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/reservas"
          className="inline-flex items-center gap-1.5 font-inter text-sm"
          style={{ color: 'var(--orange)' }}
        >
          <ArrowLeft size={15} /> Buscar otro cliente
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="font-playfair text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {reserva.cliente.nombre}
        </h1>
        <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          {reserva.oportunidad.nombre} · {reserva.oportunidad.pipeline} · {reserva.oportunidad.etapa}
          {reserva.cliente.telefono ? ` · ${reserva.cliente.telefono}` : ''}
        </p>
      </header>

      {reserva.sinResolver.length > 0 && (
        <p className="mb-4 rounded-md px-4 py-3 font-inter text-xs" style={{ background: '#fffbeb', color: '#92400e' }}>
          Ojo: {reserva.sinResolver.length} campos del catálogo no existen en GHL:{' '}
          {reserva.sinResolver.join(', ')}
        </p>
      )}

      {/* Flujo principal: primero se piden los documentos (llenan P1–P20 solos),
          después se envía el contrato. Los pasos del Generador quedan abajo
          para editar, transcribir o completar campos a mano. */}
      <PasoFlujo
        n={1}
        titulo="Recopilación de documentos"
        descripcion="Envía el enlace seguro: el cliente sube los documentos y los datos de los viajeros se escriben solos."
        estado={chipDocumentos}
        plegable
        abierto={documentos.solicitud?.estado !== 'completa'}
      >
        <DocumentosTab opportunityId={reserva.oportunidad.id} inicial={documentos} sinTitulo />
      </PasoFlujo>

      <PasoFlujo
        n={2}
        titulo="Envío del contrato"
        descripcion="Revisa la vista previa y envía el contrato para firma electrónica."
      >
        <ContratoPanel opportunityId={reserva.oportunidad.id} inicial={contrato} />
      </PasoFlujo>

      <section>
        <div className="mb-3">
          <h2 className="font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Datos de la reserva
          </h2>
          <p className="mt-0.5 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            Edita, transcribe o completa los campos que imprime el contrato. Los pasos se adaptan al tipo de
            contrato y a la cantidad de pasajeros.
          </p>
        </div>
        <Wizard
          opportunityId={reserva.oportunidad.id}
          campos={reserva.campos}
          valoresIniciales={reserva.valores}
          prefill={reserva.prefill}
        />
      </section>
    </div>
  )
}
