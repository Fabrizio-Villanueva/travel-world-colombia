import type { ReactNode } from 'react'
import { Check, X, Landmark, Monitor, Mail, QrCode, Plane } from 'lucide-react'
import { CLAUSULA_DATOS, CLAUSULA_RESPONSABILIDAD, DECLARACION_FIRMA } from '@/lib/contratos/clausulas'
import type { ContratoDatos, ContratoLiquidacionFila, ContratoPasajero } from '@/lib/contratos/tipos'
import s from './ContratoDocumento.module.css'

/**
 * Contrato de servicios turísticos de Travel World Colombia (diseño aprobado
 * 07-oct-2026). Imprime SOLO lo que existe: N trayectos, N pasajeros, las
 * tarifas usadas y los pagos pactados, así que no quedan espacios vacíos.
 * Arriba, un resumen con lo que más le importa al cliente (destino, fechas,
 * pasajeros, total y saldo); tablas compactas (12 pasajeros caben en media
 * página) que en celular se vuelven tarjetas; cláusulas a dos columnas en
 * el PDF.
 *
 * Es HTML puro (sin estado ni JS): la misma salida sirve para leerlo en el
 * celular y para generar el PDF.
 */

const AGENCIA = {
  razonSocial: 'VAMOS POR MÁS S.A.S.',
  nombre: 'Travel World Colombia',
  nit: '900537199-7',
  rnt: '27287',
  contacto: '320 489 1930',
  correo: 'agenciatravelworldcolombia@gmail.com',
  direccion: 'Tv 12 #22-42 Local 126 · C.C. Manila · Fusagasugá',
  web: 'travelworldcolombia.com',
}

const MEDIOS_DE_PAGO = [
  { Icono: Landmark, texto: 'Bancolombia Ahorros #264-133178-51 · VAMOS POR MÁS S.A.S.' },
  { Icono: Landmark, texto: 'Davivienda Corriente #406-169997292' },
  { Icono: QrCode, texto: 'Bre-B: Bancolombia 0090272526 · Davivienda @9005371997' },
  { Icono: Monitor, texto: 'PSE: zonapagos.com/basica · travelworldcolombia.com/pagos' },
  { Icono: Mail, texto: 'Comprobantes: contabilidad.travelworld@gmail.com' },
]

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

const dinero = (v?: number) => (v == null ? '' : pesos.format(v))
const vacio = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')

/** AAAA-MM-DD → DD/MM/AAAA. */
function fecha(iso?: string): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '')
}

/** Rango compacto: "12 – 17 dic 2026", "28 dic 2026 – 3 ene 2027". */
function rango(ida?: string, regreso?: string): string {
  const a = ida ? /^(\d{4})-(\d{2})-(\d{2})/.exec(ida) : null
  const b = regreso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(regreso) : null
  if (!a || !b) return [fechaCorta(ida), fechaCorta(regreso)].filter(Boolean).join(' – ')
  if (a[1] === b[1] && a[2] === b[2]) return `${Number(a[3])} – ${Number(b[3])} ${MESES[Number(b[2]) - 1]} ${b[1]}`
  if (a[1] === b[1]) return `${Number(a[3])} ${MESES[Number(a[2]) - 1]} – ${Number(b[3])} ${MESES[Number(b[2]) - 1]} ${b[1]}`
  return `${fechaCorta(ida)} – ${fechaCorta(regreso)}`
}

/** AAAA-MM-DD → "12 dic 2026". */
function fechaCorta(iso?: string): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : (iso ?? '')
}

function Parrafo({ texto }: { texto: string }) {
  return (
    <p>
      {texto.split(/(\*\*[^*]+\*\*)/).map((t, i) =>
        t.startsWith('**') ? <strong key={i}>{t.slice(2, -2)}</strong> : t
      )}
    </p>
  )
}

function Seccion({ n, titulo, children, className }: { n: number; titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={`${s.seccion} ${className ?? ''}`}>
      <h2 className={s.seccionTitulo}>
        <span className={s.seccionNumero}>{String(n).padStart(2, '0')}</span>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

/** Lista de datos (etiqueta arriba, valor abajo) que omite los vacíos. */
function Datos({ pares, columnas = 3 }: { pares: [string, ReactNode][]; columnas?: number }) {
  const llenos = pares.filter(([, v]) => !vacio(v))
  if (llenos.length === 0) return null
  return (
    <dl className={s.datos} style={{ ['--cols' as string]: columnas }}>
      {llenos.map(([etiqueta, valor]) => (
        // Valores largos (correos) ocupan dos columnas para no partirse.
        <div key={etiqueta} className={typeof valor === 'string' && valor.length > 26 ? s.datoAncho : undefined}>
          <dt>{etiqueta}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Tabla que en celular se vuelve tarjetas (cada celda lleva su etiqueta). */
function Tabla({ columnas, filas, pie }: { columnas: { titulo: string; num?: boolean }[]; filas: ReactNode[][]; pie?: ReactNode }) {
  return (
    <table className={s.tabla}>
      <thead>
        <tr>
          {columnas.map(c => (
            <th key={c.titulo} className={c.num ? s.num : undefined}>{c.titulo}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((celdas, i) => (
          <tr key={i}>
            {celdas.map((v, j) => (
              <td key={j} data-label={columnas[j].titulo} className={columnas[j].num ? s.num : undefined}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {pie}
    </table>
  )
}

/** Dato principal con una segunda línea discreta (documento, vencimiento). */
function DosLineas({ arriba, abajo, fuerte }: { arriba?: ReactNode; abajo?: ReactNode; fuerte?: boolean }) {
  return (
    <span className={s.dosLineas}>
      {fuerte ? <strong>{arriba}</strong> : arriba}
      {abajo && <span className={s.segunda}>{abajo}</span>}
    </span>
  )
}

/** "+573001234567" / "3001234567" → "+57 300 123 4567"; lo demás queda igual. */
function telefono(t?: string): string {
  if (!t) return ''
  const d = t.replace(/\D/g, '')
  const m = /^(?:57)?(3\d{2})(\d{3})(\d{4})$/.exec(d)
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : t
}

/** Columnas de la tabla de pasajeros; las opcionales solo si alguien las tiene. */
function columnasPasajeros(pasajeros: ContratoPasajero[]) {
  const hay = (c: keyof ContratoPasajero) => pasajeros.some(p => !vacio(p[c]))
  const cols: { titulo: string; celda: (p: ContratoPasajero) => ReactNode }[] = [
    { titulo: 'Pasajero', celda: p => <DosLineas fuerte arriba={p.nombre} abajo={p.documento} /> },
  ]
  if (hay('fechaNacimiento')) cols.push({ titulo: 'Nacimiento', celda: p => fecha(p.fechaNacimiento) })
  if (hay('pasaporte'))
    cols.push({
      titulo: 'Pasaporte',
      celda: p => <DosLineas arriba={p.pasaporte} abajo={p.vencePasaporte && `Vence ${fecha(p.vencePasaporte)}`} />,
    })
  if (hay('visa'))
    cols.push({ titulo: 'Visa', celda: p => <DosLineas arriba={p.visa} abajo={p.venceVisa && `Vence ${fecha(p.venceVisa)}`} /> })
  if (hay('telefono')) cols.push({ titulo: 'Teléfono', celda: p => telefono(p.telefono) })
  return cols
}

function filasLiquidacion(grupo: string, filas: ContratoLiquidacionFila[], conPlan: boolean): ReactNode[][] {
  return filas.map(f => [
    <span key="c" className={s.concepto}><span className={s.grupo}>{grupo}</span> {f.concepto}</span>,
    dinero(f.tarifaPorPax),
    f.cantidad ?? '',
    ...(conPlan ? [dinero(f.valorPlan)] : []),
    <strong key="t">{dinero(f.valorTotal)}</strong>,
  ])
}

export function ContratoDocumento({
  datos,
  firma,
  firmaPie,
  firmaAgencia,
}: {
  datos: ContratoDatos
  /** Trazo de la firma del titular (imagen) una vez firmado. */
  firma?: ReactNode
  /** Línea bajo la firma del titular ("Firmado electrónicamente el …"). */
  firmaPie?: string
  firmaAgencia?: ReactNode
}) {
  const liq = datos.liquidacion
  const columnas = columnasPasajeros(datos.pasajeros)
  const conPlan = [...liq.aereos, ...liq.terrestre].some(f => f.valorPlan != null)
  const conTrm = datos.pagos.some(p => p.trm != null)
  const ultimoPago = datos.pagos.at(-1)
  const abonado = datos.pagos.reduce((t, p) => t + (p.abono ?? 0), 0)
  const saldo = ultimoPago?.saldo ?? liq.total.valorTotal - abonado
  const v = datos.viaje

  let n = 0
  const sig = () => ++n

  return (
    <article className={s.contrato} lang="es">
      {/* ── Cabecera ── */}
      <header className={s.cabecera}>
        {/* eslint-disable-next-line @next/next/no-img-element -- también se imprime a PDF */}
        <img src="/images/travel-world-colombia-logo.png" alt="Travel World Colombia" className={s.logo} />
        <div className={s.cabeceraTexto}>
          <p className={s.eyebrow}>Contrato de servicios turísticos</p>
          <p className={s.reserva}>Reserva TW-{datos.reserva}</p>
          <p className={s.cabeceraMeta}>
            {fechaCorta(datos.fechaContrato)}
            {datos.producto ? ` · ${datos.producto}` : ''}
          </p>
        </div>
      </header>

      {/* ── Resumen: lo esencial de un vistazo ── */}
      <div className={s.resumen}>
        <div className={s.resumenDestino}>
          <Plane size={16} aria-hidden />
          <div>
            <span className={s.resumenEtiqueta}>Destino</span>
            <span className={s.resumenValor}>{datos.destino ?? '—'}</span>
          </div>
        </div>
        <div>
          <span className={s.resumenEtiqueta}>Viaje</span>
          <span className={s.resumenValor}>{rango(v.fechaIda, v.fechaRegreso)}</span>
          {v.noches != null && <span className={s.resumenNota}>{v.noches} noches</span>}
        </div>
        <div>
          <span className={s.resumenEtiqueta}>Pasajeros</span>
          <span className={s.resumenValor}>{datos.pasajeros.length || v.totalPersonas}</span>
        </div>
        <div>
          <span className={s.resumenEtiqueta}>Valor total</span>
          <span className={s.resumenValor}>{dinero(liq.total.valorTotal)}</span>
        </div>
        <div className={s.resumenSaldo}>
          <span className={s.resumenEtiqueta}>Saldo pendiente</span>
          <span className={s.resumenValor}>{dinero(saldo)}</span>
        </div>
      </div>

      <div className={s.cuerpo}>
        <Seccion n={sig()} titulo="Las partes">
          <div className={s.partes}>
            <div className={s.parte}>
              <h3>La agencia</h3>
              <Datos
                columnas={2}
                pares={[
                  ['Razón social', AGENCIA.razonSocial],
                  ['NIT', AGENCIA.nit],
                  ['Agencia', AGENCIA.nombre],
                  ['RNT', AGENCIA.rnt],
                  ['Asesor(a)', datos.agente],
                  ['Contacto', AGENCIA.contacto],
                  ['Correo', AGENCIA.correo],
                ]}
              />
            </div>
            <div className={s.parte}>
              <h3>El cliente · datos de facturación</h3>
              <Datos
                columnas={2}
                pares={[
                  ['Titular de la reserva', datos.titular.nombre],
                  ['Teléfono del titular', telefono(datos.titular.telefono)],
                  ['Facturar a', datos.facturacion.nombre],
                  ['Documento / NIT', datos.facturacion.documento],
                  ['Dirección', datos.facturacion.direccion],
                  ['Ciudad', datos.facturacion.ciudad],
                  ['Correo', datos.facturacion.correo],
                  ['Teléfono', telefono(datos.facturacion.telefono)],
                ]}
              />
            </div>
          </div>
        </Seccion>

        <Seccion n={sig()} titulo="Su viaje">
          <Datos
            columnas={4}
            pares={[
              ['Fecha de ida', fecha(v.fechaIda)],
              ['Fecha de regreso', fecha(v.fechaRegreso)],
              ['Noches', v.noches],
              ['Plan', v.plan],
              ['Habitaciones', v.habitaciones],
              ['Acomodación', v.acomodacion],
              ['Total de personas', v.totalPersonas],
            ]}
          />
          {datos.observaciones && (
            <div className={s.nota}>
              <span>Observaciones</span>
              <p>{datos.observaciones}</p>
            </div>
          )}
        </Seccion>

        {datos.trayectos.length > 0 && (
          <Seccion n={sig()} titulo="Itinerario de vuelos">
            <Tabla
              columnas={[{ titulo: '#' }, { titulo: 'Fecha' }, { titulo: 'Ruta' }, { titulo: 'Vuelo' }, { titulo: 'Aerolínea' }, { titulo: 'Sale' }, { titulo: 'Llega' }]}
              filas={datos.trayectos.map((t, i) => [
                i + 1,
                fecha(t.fechaSalida),
                <strong key="r">{t.ruta}</strong>,
                t.vuelo ?? '',
                t.aerolinea ?? '',
                t.horaSalida ?? '',
                t.horaLlegada ?? '',
              ])}
            />
            {datos.notas && (
              <div className={s.nota}>
                <span>Notas importantes</span>
                <p>{datos.notas}</p>
              </div>
            )}
          </Seccion>
        )}

        {datos.pasajeros.length > 0 && (
          <Seccion n={sig()} titulo={`Pasajeros (${datos.pasajeros.length})`}>
            <Tabla
              columnas={[{ titulo: '#' }, ...columnas.map(c => ({ titulo: c.titulo }))]}
              filas={datos.pasajeros.map((p, i) => [i + 1, ...columnas.map(c => c.celda(p))])}
            />
          </Seccion>
        )}

        <Seccion n={sig()} titulo="Liquidación">
          <Tabla
            columnas={[
              { titulo: 'Concepto' },
              { titulo: 'Tarifa por pax', num: true },
              { titulo: 'Cant.', num: true },
              ...(conPlan ? [{ titulo: 'Valor plan', num: true }] : []),
              { titulo: 'Valor total', num: true },
            ]}
            filas={[
              ...filasLiquidacion('Aéreo', liq.aereos, conPlan),
              ...filasLiquidacion('Terrestre', liq.terrestre, conPlan),
            ]}
            pie={
              <tfoot>
                <tr className={s.total}>
                  <td>Total del viaje</td>
                  <td />
                  <td className={s.num}>{liq.total.cantidad ?? ''}</td>
                  {conPlan && <td className={s.num}>{dinero(liq.total.valorPlan)}</td>}
                  <td className={s.num}>{dinero(liq.total.valorTotal)}</td>
                </tr>
                {liq.dolares && (
                  <tr className={s.dolares}>
                    <td>Valor en dólares · TRM {dinero(liq.dolares.trm)}</td>
                    <td />
                    <td />
                    {conPlan && <td className={s.num}>{liq.dolares.valorPlan != null ? `USD ${numero.format(liq.dolares.valorPlan)}` : ''}</td>}
                    <td className={s.num}>{liq.dolares.valorTotal != null ? `USD ${numero.format(liq.dolares.valorTotal)}` : ''}</td>
                  </tr>
                )}
              </tfoot>
            }
          />
        </Seccion>

        {/* Pagos y condiciones viajan juntos al imprimir: así ninguno queda
            solo en una hoja casi vacía. */}
        <div className={s.juntos}>
          <Seccion n={sig()} titulo="Plan de pagos">
            {datos.pagos.length > 0 && (
              <Tabla
                columnas={[
                  { titulo: '#' },
                  { titulo: 'Fecha' },
                  { titulo: 'Medio de pago' },
                  ...(conTrm ? [{ titulo: 'TRM', num: true }] : []),
                  { titulo: 'Abono', num: true },
                  { titulo: 'Saldo', num: true },
                ]}
                filas={datos.pagos.map((p, i) => [
                  i + 1,
                  fecha(p.fecha),
                  p.medio ?? '',
                  ...(conTrm ? [dinero(p.trm)] : []),
                  <strong key="a">{dinero(p.abono)}</strong>,
                  dinero(p.saldo),
                ])}
              />
            )}
            <div className={s.medios}>
              <span className={s.mediosTitulo}>Medios de pago autorizados</span>
              <ul>
                {MEDIOS_DE_PAGO.map(({ Icono, texto }) => (
                  <li key={texto}>
                    <Icono size={12} aria-hidden /> {texto}
                  </li>
                ))}
              </ul>
            </div>
          </Seccion>

          {(datos.incluye.length > 0 || datos.noIncluye.length > 0) && (
            <Seccion n={sig()} titulo="Condiciones de su plan">
              <div className={s.condiciones}>
                <div>
                  <h3 className={s.incluyeTitulo}>Incluye</h3>
                  <ul className={s.lista}>
                    {datos.incluye.map(x => (
                      <li key={x}><Check size={13} className={s.si} aria-hidden /> {x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className={s.noIncluyeTitulo}>No incluye</h3>
                  <ul className={s.lista}>
                    {datos.noIncluye.map(x => (
                      <li key={x}><X size={13} className={s.no} aria-hidden /> {x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Seccion>
          )}
        </div>

        {/* Hoja legal: las dos cláusulas, la declaración y las firmas van
            SIEMPRE juntas en una hoja propia (nunca se cortan). */}
        <div className={s.hojaLegal}>
          <Seccion n={sig()} titulo={CLAUSULA_RESPONSABILIDAD.titulo} className={s.clausula}>
            <div className={s.clausulaTexto}>
              {CLAUSULA_RESPONSABILIDAD.parrafos.map((p, i) => <Parrafo key={i} texto={p} />)}
            </div>
          </Seccion>

          <Seccion n={sig()} titulo={CLAUSULA_DATOS.titulo} className={s.clausula}>
            <div className={s.clausulaTexto}>
              {CLAUSULA_DATOS.parrafos.map((p, i) => <Parrafo key={i} texto={p} />)}
            </div>
          </Seccion>

          <section className={s.firmaSeccion}>
            <p className={s.declaracion}>{DECLARACION_FIRMA}</p>
            <div className={s.firmas}>
              <div className={s.firma}>
                <div className={s.firmaTrazo}>{firma}</div>
                <span className={s.firmaNombre}>{datos.titular.nombre}</span>
                <span className={s.firmaRol}>
                  Cliente - viajero{datos.titular.documento ? ` · ${datos.titular.documento}` : ''}
                </span>
                {firmaPie && <span className={s.firmaPie}>{firmaPie}</span>}
              </div>
              <div className={s.firma}>
                <div className={s.firmaTrazo}>{firmaAgencia}</div>
                <span className={s.firmaNombre}>{datos.agente ?? AGENCIA.nombre}</span>
                <span className={s.firmaRol}>Travel World Colombia · NIT {AGENCIA.nit}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className={s.pie}>
        {AGENCIA.razonSocial} · NIT {AGENCIA.nit} · RNT {AGENCIA.rnt} · {AGENCIA.direccion} · {AGENCIA.web}
      </footer>
    </article>
  )
}
