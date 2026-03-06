
export interface ExamQuestion {
  q: string;
  options: string[];
}

export interface ExamData {
  id: string;
  title: string;
  questions: ExamQuestion[];
}

export const EXAMS: ExamData[] = [
  {
    id: '1',
    title: 'Examen de Conocimientos Teóricos #1',
    questions: [
      { q: 'Maniobra mediante el cual un vehículo adelanta a otro que lo antecede en el mismo carril de una calzada.', options: ['a) Pasar al otro carril.', 'b) Rebasar.', 'c) Emparejar.', 'd) Aparcar.'] },
      { q: 'Todos los vehículos deben mantener encendidas las luces exteriores a partir de.', options: ['a) De 6:00pm a 6:00am o cuando las condiciones de visibilidad sean adversas.', 'b) Cuando el policía lo exija.', 'c) Cuando sea de noche o el auto tenga desperfecto.', 'd) Todas las anteriores.'] },
      { q: '¿Qué peatones deben hacerse acompañar de una persona mayor de 16 años?', options: ['a) Los mayores de 90 años.', 'b) Los menos de 12 años.', 'c) Los menores de 5 años.', 'd) Todas las anteriores.'] },
      { q: 'Según el artículo 132 de la ley de tránsito la licencia de conducir se debe', options: ['a) Enseñar.', 'b) Presentar.', 'c) Entregar.', 'd) Ninguna de las anteriores.'] },
      { q: 'Los conductores de vehículos de transporte colegial deben:', options: ['a) Garantizar la integridad física de los estudiantes que transportan.', 'b) Cuidar del vehículo.', 'c) Ninguna de las anteriores.'] },
      { q: 'Es prohibido a los peatones y conductores de vehículos', options: ['a) Caminar o conducir con aliento alcohólico o en estado de embriaguez comprobada.', 'b) Caminar o conducir bajo los efectos de estupefacientes.', 'c) A y B son correctos.', 'd) Ninguna de los anteriores.'] },
      { q: 'En zonas distintas a las rurales, solamente se podrán remolcar vehículos por medio de:', options: ['a) Una grúa.', 'b) Una lanza de metal.', 'c) Otro auto con cadenas seguras.', 'd) Todas las anteriores.'] },
      { q: 'Para transitar por caminos y calles, las cabalgaduras deben estar provistas de:', options: ['a) Dispositivos reflectivos.', 'b) Herraduras.', 'c) Montura adecuada.', 'd) Ninguna de las anteriores.'] },
      { q: 'Las infracciones de tránsito serán sancionadas con:', options: ['a) Amonestaciones o multa y la asignación de puntos en la forma prevista en el presente reglamento.', 'b) El inspector de tránsito.', 'c) El juez de tránsito.', 'd) Todas las anteriores.'] },
      { q: 'La audiencia se efectuará', options: ['a) Cuando el policía esté disponible.', 'b) El día y hora señalada con las partes que concurran.', 'c) Se pone otra fecha.', 'd) Todas las anteriores.'] }
    ]
  },
  {
    id: '2',
    title: 'Examen de Conocimientos Teóricos #2',
    questions: [
      { q: 'Vía pública utilizada para el tránsito interurbano de vehículos con niveles adecuados de seguridad y comodidad.', options: ['a) Avenidas.', 'b) Avenidas y calles.', 'c) Carreteras.', 'd) Aceras.'] },
      { q: 'Los vehículos a motor deben portar el siguiente equipo de seguridad en las vías de circulación.', options: ['a) Triangulo reflectivo de seguridad, herramientas básicas, llanta de repuesto, elevador mecánico, herramientas para reemplazo de llantas.', 'b) Reglamento de tránsito.', 'c) Licencia de conducir.', 'd) Todas las anteriores.'] },
      { q: 'Los peatones caminarán obligatoriamente por:', options: ['a) Las aceras, veredas, pasos elevados y demás facilidades habilitadas para su uso.', 'b) Pavimento.', 'c) Aceras únicamente.', 'd) Puentes elevados peatones solamente.'] },
      { q: 'Los extranjeros que ingresen a la República de Panamá en calidad de turista solamente podrán conducir vehículos con licencia vigente de su país de origen por:', options: ['a) 30 días.', 'b) 60 días.', 'c) 90 días.', 'd) 120 días.'] },
      { q: 'Artículo 125. Todo conductor de vehículo está en la obligación de:', options: ['a) Portar su licencia de conducir.', 'b) Portar los documentos del vehículo.', 'c) Portar la placa de circulación.', 'd) Ninguna de las anteriores.'] },
      { q: 'El estado de embriaguez y la intoxicación por estupefacientes se determinará por cualquier de los siguientes exámenes y pruebas:', options: ['a) Análisis de aires expírales (estado de embriaguez).', 'b) Pruebas de estado físico.', 'c) Médicas.', 'd) Todas las anteriores.'] },
      { q: 'En carreteras o autopistas, los triciclos y las motocicletas que transmiten en grupos lo harán:', options: ['a) En forma de X.', 'b) En forma de Z.', 'c) En fila.', 'd) Ninguna de las anteriores.'] },
      { q: 'Los conductores de vehículos:', options: ['a) Serán responsables de los animales que se encuentren en la vía.', 'b) No serán responsables de los daños que sufran los animales que se hallen en las vías públicas, incluyendo la muerte de éstos.', 'c) Ninguna de las anteriores.'] },
      { q: 'La aplicación y ejecución del presente reglamento en todas sus partes compete a:', options: ['a) La Policía Nacional.', 'b) Los jueces de tránsito.', 'c) La Autoridad de Tránsito y Transporte Terrestre.', 'd) Todas las anteriores.'] },
      { q: 'Los procesos de tránsito serán:', options: ['a) Orales en la primera instancia y escritos en la segunda.', 'b) Solo orales.', 'c) Solo escritos en ambas instancias.', 'd) Todas las anteriores.'] }
    ]
  },
  {
    id: '3',
    title: 'Examen de Conocimientos Teóricos #3',
    questions: [
      { q: 'Preferencia en la circulación que tiene un vehículo o peatón con respecto a los demás vehículos o peatones.', options: ['a) Derecho de vía.', 'b) Carril Principal.', 'c) Ceder al paso.', 'd) Transitar por el carril izquierdo.'] },
      { q: 'Para transitar en las vías públicas, todo vehículo requiere una placa única y definitiva suministrada por:', options: ['a) La Autoridad de Tránsito y Transporte Terrestre.', 'b) El Municipio donde se encuentra inscrito.', 'c) En la agencia donde lo compró.', 'd) En la junta comunal.'] },
      { q: 'En caso de no existir aceras, los peatones transitarán:', options: ['a) Por los puentes elevados peatonales.', 'b) Por los parques fuera de la vía.', 'c) Del lado izquierdo de la vía con el sentido del tránsito de vehículos de frente.', 'd) Ninguna de las anteriores.'] },
      { q: 'Los extranjeros que ingresen a la República de Panamá en calidad de turistas podrán conducir vehículos tipo:', options: ['a) Transporte colectivo.', 'b) Particulares.', 'c) Selectivo.', 'd) Todas las anteriores.'] },
      { q: 'No podrán viajar en el asiento delantero del vehículo, excepto en vehículos de una sola cabina.', options: ['a) Los pasajeros menores de cinco (5) años.', 'b) Los pasajeros menores de dos (2) años.', 'c) Los pasajeros menores de diez (10) años.', 'd) Todas las anteriores.'] },
      { q: 'Están en la obligación de someterse a las pruebas para determinar el grado de intoxicación por alcohol:', options: ['a) En caso de peatones involucrados en accidentes por atropello.', 'b) Todo conductor de vehículo a motor.', 'c) A y B son correctas.', 'd) Ninguna de las anteriores.'] },
      { q: 'Al rebasar otro vehículo deberá hacerlo:', options: ['a) Por la derecha.', 'b) Por la izquierda.', 'c) Por el carril de centro.', 'd) Todas las anteriores.'] },
      { q: 'Las cabalgaduras deberán transitar:', options: ['a) Por el lado derecho de la vía.', 'b) Por los hombros.', 'c) Por la calzada con precaución.', 'd) Ninguna de las anteriores.'] },
      { q: 'Las acciones u omisiones contrarias a este reglamento tendrán el carácter de:', options: ['a) Mulas.', 'b) Accidentes.', 'c) Infracciones de tránsito.', 'd) Ninguna de las anteriores.'] },
      { q: 'El accidente de tránsito es materia de conocimiento de:', options: ['a) La Policía de Tránsito.', 'b) Los inspectores de la A.T.T.T.', 'c) A y B son correctas.', 'd) De los jueces de tránsito.'] }
    ]
  },
  {
    id: '4',
    title: 'Examen de Conocimientos Teóricos #4',
    questions: [
      { q: 'Circulación de personas, animales o vehículos por una vía o privada abierta al pública.', options: ['a) Caminos.', 'b) Veredas.', 'c) Calles.', 'd) Tránsito.'] },
      { q: 'Es obligatorio para todo conductor reemplazar el sistema de luces altas por el sistema de luces bajas siempre que se encuentren con otro vehículo.', options: ['a) Este reemplazo se hará a una distancia no menor de ciento cincuenta (150) metros en carreteras y autopistas y no menos de setenta y cinco (75) metros, en calles y avenidas.', 'b) Solamente en carreteras.', 'c) A 150 metros en autopistas.', 'd) Todas son correctas.'] },
      { q: 'Detenerse en aceras y formar tumultos que impidan la circulación es una infracción de:', options: ['a) Los conductores.', 'b) Peatones.', 'c) Camiones de cargas.', 'd) Todas las anteriores.'] },
      { q: '¿Según el artículo 125 de la ley de tránsito a quien se le debe entregar la licencia de conducir?', options: ['a) Al policía.', 'b) A los inspectores de la A.T.T.T.', 'c) A y B son correctos.', 'd) Ninguna de las anteriores.'] },
      { q: 'Cobrar deliberadamente a pasajeros en vehículos particulares, comerciales y de transporte gratuito de empleados es:', options: ['a) Una obligación.', 'b) Una prohibición.', 'c) Una norma de transporte.', 'd) Ninguna de las anteriores.'] },
      { q: 'Cuando se procede a sancionar con multa y retención del vehículo.', options: ['a) Embriaguez comprobada.', 'b) Aliento a alcohólico.', 'c) Nivel e tolerancia.', 'd) Todas las anteriores.'] },
      { q: 'Las señales viales de tránsito se clasifican en:', options: ['a) Preventivas, Reglamentarias.', 'b) Informativas.', 'c) A y B son correctos.', 'd) Ninguna de las anteriores.'] },
      { q: 'Las personas que guíen ganado bravo deben:', options: ['a) Extremar las medidas de seguridad.', 'b) Transportarlos en un vehículo automotor.', 'c) Llevarlos fuera de la vía de circulación.', 'd) A y B son correctas.'] },
      { q: 'Las infracciones serán del conocimiento de:', options: ['a) El departamento de infracciones menores de la A.T.T.T.', 'b) Del policía de tránsito.', 'c) Del director general.', 'd) Ninguna de las anteriores.'] },
      { q: 'La resolución de primera instancia proferida por el Juez de Tránsito admite recurso de:', options: ['a) Apelación.', 'b) Resolución.', 'c) Reconsideración.', 'd) Ninguna de las anteriores.'] }
    ]
  },
  {
    id: '5',
    title: 'Examen de Conocimientos Teóricos #5',
    questions: [
      { q: 'Carril destinado para el uso único de un determinado tipo de vehículo y que muestra una separación física longitudinal a través de elementos fijos, tales como barreras o cordones o por medio de señalización especial. Puede mantener cruces a nivel con otras vías, así como con los peatones.', options: ['a) Carril exclusivo.', 'b) Carril derecho.', 'c) Aceras.'] },
      { q: 'Vehículo destinado al transporte de turistas debidamente registrado e identificado como tal, con las normas y características que se exijan para esta actividad.', options: ['a) Vehículos de uso particular en general.', 'b) Vehículos de turismo.', 'c) Taxis.', 'd) Buses.'] },
      { q: 'Antes de cruzar la vía, todo peatón esperará:', options: ['a) El momento en que no exista tránsito vehicular.', 'b) Que éste se halle detenido.', 'c) Que la distancia de los vehículos más próximos sea tal que pueda realizar el cruce a paso normal.', 'd) Todas las anteriores.'] },
      { q: 'Quienes podrán obtener una licencia de conducir vehículos, siempre que cumplan con los requisitos establecidos en el presente Reglamento.', options: ['a) Los panameños por nacimiento.', 'b) Los mayores de 25 años.', 'c) Los panameños y extranjeros mayores de 18 años.', 'd) Ninguna de los anteriores.'] },
      { q: 'Artículo 122. Todo conductor es responsable del vehículo que conduce y está en la obligación de:', options: ['a) Velar por la seguridad de sus pasajeros y de la carga que transporta.', 'b) Por la seguridad de los peatones.', 'c) No dañar el vehículo.', 'd) A y B son correctas de acuerdo con el artículo.'] },
      { q: 'El alcohol es:', options: ['a) Una droga psico depresora de consumo legal.', 'b) Una bebida prohibida.', 'c) Una bebida para conductores mayores de 18 años.', 'd) Ninguna de las anteriores.'] },
      { q: 'Artículo 144. Los conductores de vehículos están obligados.', options: ['a) Moderar la marcha y a detenerla en donde la autoridad competente lo ordene.', 'b) De acuerdo con las circunstancias del tránsito, de la vía, de la visibilidad de los propios vehículos o peatones.', 'c) Deberán conducir prudentemente para evitar posibles accidentes o prejuicios a terceras personas.', 'd) Todas las anteriores.'] },
      { q: 'El tránsito por las vías públicas de caballería, ganado en manadas o rebaños se permitirá únicamente cuando:', options: ['a) Sea zona de lechería o de cría de ganado.', 'b) Cuando no existen otras vías utilizadas que permitan realizar esta actividad.', 'c) Cuando la servidumbre tenga la maleza alta.', 'd) Todas las anteriores.'] },
      { q: 'Cuando el infractor incurra en varias faltas a la vez se le aplicará:', options: ['a) La sanción por la falta más grave.', 'b) La sanción por la falta más leve.', 'c) Una sanción por cada falta cometida.', 'd) Ninguna de las anteriores.'] },
      { q: 'Los procesos administrativos sobre accidentes de tránsito se tramitarán en:', options: ['a) Dos instancias; la primera ante el juzgado de tránsito y la segunda instancia ante la Autoridad Municipal correspondiente.', 'b) En los lugares donde no existan juzgados de tránsito, la primera instancia la constituye la Autoridad Municipal y la segunda instancia la Gobernación de la Provincia.', 'c) A y B son correctos.', 'd) Ninguna de las anteriores.'] }
    ]
  }
];
