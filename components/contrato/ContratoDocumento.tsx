import type { ReactNode } from 'react'
import { Landmark, Monitor, Mail, QrCode } from 'lucide-react'
import { CLAUSULA_DATOS, CLAUSULA_RESPONSABILIDAD, DECLARACION_FIRMA } from '@/lib/contratos/clausulas'
import type { ContratoDatos, ContratoLiquidacionFila, ContratoPasajero } from '@/lib/contratos/tipos'
import s from './ContratoDocumento.module.css'

/**
 * Contrato de servicios turísticos de Travel World Colombia. Calca el diseño
 * de la plantilla de GHL (cabecera azul marino, barras de sección, etiquetas
 * en celeste, recuadros con borde naranja) pero imprime SOLO lo que existe:
 * N trayectos, N pasajeros, las tarifas usadas y los pagos pactados.
 *
 * Es HTML puro (sin estado ni JS): la misma salida sirve para leerlo en el
 * celular y para generar el PDF.
 */

const AGENCIA = {
  razonSocial: 'VAMOS POR MÁS SAS',
  nombre: 'TRAVEL WORLD COLOMBIA',
  nit: '900537199-7',
  rnt: '27287',
  contacto: '320 489 1930',
  correo: 'agenciatravelworldcolombia@gmail.com',
  direccion: 'Tv 12 #22-42 Local 126 · C.C. Manila · Fusagasugá',
  web: 'www.travelworldcolombia.com',
}

const MEDIOS_DE_PAGO = [
  { Icono: Landmark, texto: 'Bancolombia Ahorros #264-133178-51 · VAMOS POR MÁS S.A.S.' },
  { Icono: Landmark, texto: 'Davivienda Corriente #406-169997292' },
  { Icono: QrCode, texto: 'Bre-B: Bancolombia 0090272526 · Davivienda @9005371997' },
  { Icono: Monitor, texto: 'PSE: zonapagos.com/basica · travelworldcolombia.com/pagos' },
  { Icono: Mail, texto: 'contabilidad.travelworld@gmail.com' },
]

/** Párrafo con **negrita** (único formato que usan las cláusulas). */
function Parrafo({ texto }: { texto: string }) {
  return (
    <p>
      {texto.split(/(\*\*[^*]+\*\*)/).map((t, i) =>
        t.startsWith('**') ? <strong key={i}>{t.slice(2, -2)}</strong> : t
      )}
    </p>
  )
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

function dinero(v?: number): string {
  return v == null ? '' : pesos.format(v)
}

/** AAAA-MM-DD → DD/MM/AAAA (sin pasar por Date: evita corrimientos de zona). */
function fecha(iso?: string): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

const vacio = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')

/** Pares etiqueta/valor en rejilla de 4 columnas (2 en celular); omite vacíos. */
function Campos({ pares, destacar }: { pares: [string, ReactNode][]; destacar?: boolean }) {
  const llenos = pares.filter(([, v]) => !vacio(v))
  if (llenos.length === 0) return null
  return (
    <div className={s.campos}>
      {llenos.map(([etiqueta, valor], i) => (
        <div key={etiqueta} className={`${s.par} ${i === llenos.length - 1 && llenos.length % 2 === 1 ? s.parAncho : ''}`}>
          <span className={`${s.etiqueta} ${destacar && i === 0 ? s.etiquetaDestacada : ''}`}>{etiqueta}</span>
          <span className={s.valor}>{valor}</span>
        </div>
      ))}
    </div>
  )
}

function Seccion({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={`${s.seccion} ${className ?? ''}`}>
      <h2 className={s.barra}>{titulo}</h2>
      {children}
    </section>
  )
}

/** Columnas de pasajero que tiene AL MENOS uno: así todos los bloques calzan. */
const COLUMNAS_PASAJERO: { clave: keyof ContratoPasajero; titulo: string; formato?: (v: string) => string }[] = [
  { clave: 'fechaNacimiento', titulo: 'Fecha de nacimiento', formato: fecha },
  { clave: 'pasaporte', titulo: 'No. pasaporte' },
  { clave: 'vencePasaporte', titulo: 'Vigencia pasaporte', formato: fecha },
  { clave: 'telefono', titulo: 'Teléfono' },
  { clave: 'visa', titulo: 'No. visa' },
  { clave: 'venceVisa', titulo: 'Vigencia visa', formato: fecha },
]

function TablaLiquidacion({ titulo, filas, conPlan }: { titulo: string; filas: ContratoLiquidacionFila[]; conPlan: boolean }) {
  if (filas.length === 0) return null
  return (
    <>
      <tr>
        <th colSpan={conPlan ? 5 : 4} className={s.subbarra}>{titulo}</th>
      </tr>
      {filas.map(f => (
        <tr key={f.concepto}>
          <td className={s.concepto}>{f.concepto}</td>
          <td>{dinero(f.tarifaPorPax)}</td>
          <td className={s.centro}>{f.cantidad ?? ''}</td>
          {conPlan && <td>{dinero(f.valorPlan)}</td>}
          <td className={s.fuerte}>{dinero(f.valorTotal)}</td>
        </tr>
      ))}
    </>
  )
}

export function ContratoDocumento({
  datos,
  firma,
  firmaAgencia,
}: {
  datos: ContratoDatos
  /** Trazo de la firma del titular (imagen) una vez firmado. */
  firma?: ReactNode
  firmaAgencia?: ReactNode
}) {
  const { liquidacion: liq } = datos
  const columnas = COLUMNAS_PASAJERO.filter(c => datos.pasajeros.some(p => !vacio(p[c.clave])))
  const conPlan = [...liq.aereos, ...liq.terrestre].some(f => f.valorPlan != null) || liq.total.valorPlan != null
  const conTrm = datos.pagos.some(p => p.trm != null)

  return (
    <article className={s.contrato} lang="es">
      {/* ── Cabecera ── */}
      <header className={s.cabecera}>
        <h1 className={s.titulo}>Contrato de servicios turísticos</h1>
        <div className={s.cabeceraFila}>
          <div className={s.marca}>
            {/* eslint-disable-next-line @next/next/no-img-element -- también se imprime a PDF; <img> plano es lo más fiel */}
            <img src="/images/travel-world-colombia-logo-blanco.png" alt="Travel World Colombia" className={s.logo} />
            <p className={s.direccion}>{AGENCIA.direccion}</p>
            <p className={s.web}>{AGENCIA.web}</p>
          </div>
          <dl className={s.ficha}>
            <div><dt>Fecha</dt><dd>{fecha(datos.fechaContrato)}</dd></div>
            <div><dt>Reserva</dt><dd>TW-{datos.reserva}</dd></div>
            {datos.producto && <div><dt>Producto</dt><dd>{datos.producto}</dd></div>}
            {datos.destino && <div><dt>Destino</dt><dd>{datos.destino}</dd></div>}
          </dl>
        </div>
      </header>
      <div className={s.franja} aria-hidden />

      <Seccion titulo="Datos de la agencia">
        <Campos
          pares={[
            ['Razón social', AGENCIA.razonSocial],
            ['Agencia', AGENCIA.nombre],
            ['NIT', AGENCIA.nit],
            ['RNT', AGENCIA.rnt],
            ['Agente', datos.agente],
            ['Contacto', AGENCIA.contacto],
            ['Email agente', AGENCIA.correo],
          ]}
        />
      </Seccion>

      <Seccion titulo="Datos para su factura electrónica">
        <Campos
          pares={[
            ['Nombre', datos.facturacion.nombre],
            ['Documento / NIT', datos.facturacion.documento],
            ['Dirección', datos.facturacion.direccion],
            ['Ciudad', datos.facturacion.ciudad],
            ['Email', datos.facturacion.correo],
            ['Teléfono', datos.facturacion.telefono],
            ['Titular de la reserva', datos.titular.nombre],
            ['Teléfono del titular', datos.titular.telefono],
          ]}
        />
      </Seccion>

      <Seccion titulo="Generales del viaje">
        <Campos
          pares={[
            ['Fecha de ida', fecha(datos.viaje.fechaIda)],
            ['No. de noches', datos.viaje.noches],
            ['Fecha de regreso', fecha(datos.viaje.fechaRegreso)],
            ['Plan', datos.viaje.plan],
            ['Habitaciones', datos.viaje.habitaciones],
            ['Acomodación', datos.viaje.acomodacion],
            ['Total de personas', datos.viaje.totalPersonas],
          ]}
        />
      </Seccion>

      {datos.observaciones && (
        <Seccion titulo="Observaciones">
          <p className={s.recuadro}>{datos.observaciones}</p>
        </Seccion>
      )}

      {(datos.trayectos.length > 0 || datos.notas) && (
        <Seccion titulo="Información de su itinerario">
          {datos.trayectos.map((t, i) => (
            <div key={i} className={s.bloque}>
              <Campos
                destacar
                pares={[
                  [`Trayecto ${i + 1}`, t.ruta],
                  ['Fecha de salida', fecha(t.fechaSalida)],
                  ['Hora de salida', t.horaSalida],
                  ['Hora de llegada', t.horaLlegada],
                  ['No. de vuelo', t.vuelo],
                  ['Aerolínea', t.aerolinea],
                ]}
              />
            </div>
          ))}
          {datos.notas && (
            <div className={`${s.bloque} ${s.notas}`}>
              <span className={s.notasEtiqueta}>Notas</span>
              <p>{datos.notas}</p>
            </div>
          )}
        </Seccion>
      )}

      {datos.pasajeros.length > 0 && (
        <Seccion titulo={`Pasajeros (${datos.pasajeros.length})`}>
          {datos.pasajeros.map((p, i) => (
            <div key={i} className={s.bloque}>
              <h3 className={s.pasajeroTitulo}>Pasajero {i + 1}</h3>
              <Campos pares={[['Nombre completo', p.nombre], ['Documento', p.documento]]} />
              {columnas.length > 0 && (
                <div className={s.tablaPasajero} style={{ ['--cols' as string]: columnas.length }}>
                  {columnas.map(c => (
                    <div key={c.clave} className={s.celdaPasajero}>
                      <span className={s.subtitulo}>{c.titulo}</span>
                      <span className={s.valor}>{c.formato ? c.formato(p[c.clave] ?? '') : (p[c.clave] ?? '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Seccion>
      )}

      <Seccion titulo="Liquidación">
        <div className={s.tablaScroll}>
          <table className={s.tabla}>
            <thead>
              <tr>
                <th />
                <th>Tarifa por pax</th>
                <th>Cantidad</th>
                {conPlan && <th>Valor plan</th>}
                <th>Valor total</th>
              </tr>
            </thead>
            <tbody>
              <TablaLiquidacion titulo="Liquidación aéreos" filas={liq.aereos} conPlan={conPlan} />
              <TablaLiquidacion titulo="Liquidación porción terrestre" filas={liq.terrestre} conPlan={conPlan} />
              <tr className={s.total}>
                <td>Total pasajeros</td>
                <td />
                <td className={s.centro}>{liq.total.cantidad ?? ''}</td>
                {conPlan && <td>{dinero(liq.total.valorPlan)}</td>}
                <td>{dinero(liq.total.valorTotal)}</td>
              </tr>
              {liq.dolares && (
                <tr className={s.dolares}>
                  <td>Valor en dólares</td>
                  <td colSpan={2}>TRM vigente: {dinero(liq.dolares.trm)}</td>
                  {conPlan && <td>{liq.dolares.valorPlan != null ? `USD ${numero.format(liq.dolares.valorPlan)}` : ''}</td>}
                  <td>{liq.dolares.valorTotal != null ? `USD ${numero.format(liq.dolares.valorTotal)}` : ''}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Registro de pagos">
        {datos.pagos.length > 0 && (
          <div className={s.tablaScroll}>
            <table className={s.tabla}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Fecha</th>
                  <th>Medio de pago</th>
                  {conTrm && <th>TRM</th>}
                  <th>Total plan</th>
                  <th>Abono</th>
                  <th>Saldo en pesos</th>
                </tr>
              </thead>
              <tbody>
                {datos.pagos.map((p, i) => (
                  <tr key={i}>
                    <td className={s.centro}>{i + 1}</td>
                    <td className={s.centro}>{fecha(p.fecha)}</td>
                    <td className={s.izquierda}>{p.medio ?? ''}</td>
                    {conTrm && <td>{dinero(p.trm)}</td>}
                    <td>{dinero(p.totalPlan)}</td>
                    <td className={s.fuerte}>{dinero(p.abono)}</td>
                    <td>{dinero(p.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={s.medios}>
          <span className={s.mediosTitulo}>Medios de pago</span>
          <ul>
            {MEDIOS_DE_PAGO.map(({ Icono, texto }) => (
              <li key={texto}>
                <Icono size={11} aria-hidden /> {texto}
              </li>
            ))}
          </ul>
        </div>
      </Seccion>

      {(datos.incluye.length > 0 || datos.noIncluye.length > 0) && (
        <Seccion titulo="Condiciones de su plan">
          <div className={s.condiciones}>
            <div className={s.incluye}>
              <h3>Incluye</h3>
              <ul>{datos.incluye.map(x => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className={s.noIncluye}>
              <h3>No incluye</h3>
              <ul>{datos.noIncluye.map(x => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        </Seccion>
      )}

      {[CLAUSULA_RESPONSABILIDAD, CLAUSULA_DATOS].map(c => (
        <Seccion key={c.titulo} titulo={c.titulo} className={s.clausula}>
          <div className={s.clausulaTexto}>
            {c.parrafos.map((p, i) => <Parrafo key={i} texto={p} />)}
          </div>
        </Seccion>
      ))}

      <section className={`${s.seccion} ${s.firmaSeccion}`}>
        <p className={s.declaracion}>{DECLARACION_FIRMA}</p>
        <div className={s.firmas}>
          <div className={s.firmaCol}>
            <h3 className={s.firmaCabeza}>{AGENCIA.nombre}</h3>
            <Campos pares={[['Nombre', datos.agente ?? AGENCIA.nombre], ['NIT', `${AGENCIA.nit} · ${AGENCIA.razonSocial}`]]} />
            <div className={s.firmaTrazo}>{firmaAgencia}</div>
            <span className={s.firmaRol}>Firma</span>
          </div>
          <div className={s.firmaCol}>
            <h3 className={s.firmaCabeza}>Cliente - viajero</h3>
            <Campos pares={[['Nombre', datos.titular.nombre], ['Documento', datos.titular.documento]]} />
            <div className={s.firmaTrazo}>{firma}</div>
            <span className={s.firmaRol}>Firma</span>
          </div>
        </div>
      </section>
    </article>
  )
}
