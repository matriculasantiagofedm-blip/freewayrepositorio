
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
      { q: '¿Cuál es la función principal del cinturón de seguridad?', options: ['a) Evitar multas.', 'b) Mantener al pasajero en su asiento y evitar impactos contra el interior del vehículo.', 'c) Comodidad al conducir.', 'd) Ninguna de las anteriores.'] },
      { q: '¿Qué debe verificar periódicamente en los neumáticos?', options: ['a) El color.', 'b) La presión de aire y el desgaste de la banda de rodadura.', 'c) La marca de fábrica.', 'd) Si brillan.'] },
      { q: 'Si el motor se sobrecalienta, usted debe:', options: ['a) Seguir hasta llegar a casa.', 'b) Apagar el aire acondicionado y detenerse en un lugar seguro.', 'c) Abrir el radiador de inmediato.', 'd) Echarle agua fría al motor encendido.'] },
      { q: 'El uso de distractores como el celular al conducir aumenta el riesgo de accidente en un:', options: ['a) 10%.', 'b) 50%.', 'c) 400% o más.', 'd) No afecta si usa manos libres.'] },
      { q: 'Los niños menores de 5 años deben viajar en:', options: ['a) El asiento delantero.', 'b) El asiento trasero en silla de seguridad adecuada.', 'c) En los brazos de un adulto.', 'd) Donde ellos quieran.'] },
      { q: 'Si los frenos fallan mientras conduce, usted debe:', options: ['a) Apagar el motor.', 'b) Bombear el pedal de freno y usar el freno de mano gradualmente.', 'c) Saltarse del auto.', 'd) Tocar la bocina y cerrar los ojos.'] },
      { q: 'La función de los espejos retrovisores es:', options: ['a) Ver cómo luce el conductor.', 'b) Eliminar puntos ciegos y vigilar el entorno del vehículo.', 'c) Reflejar la luz del sol.', 'd) Ninguna de las anteriores.'] },
      { q: '¿Para qué sirve el sistema de suspensión?', options: ['a) Para que el auto corra más.', 'b) Para absorber las irregularidades del terreno y dar estabilidad.', 'c) Para frenar el auto.', 'd) Para encender las luces.'] },
      { q: '¿Qué líquido se debe revisar para asegurar la visibilidad en lluvia?', options: ['a) Aceite de motor.', 'b) Líquido de frenos.', 'c) Líquido limpiaparabrisas.', 'd) Refrigerante.'] },
      { q: 'El humo negro saliendo del escape suele indicar:', options: ['a) Consumo excesivo de combustible.', 'b) Quema de aceite.', 'c) Motor frío.', 'd) Fallo en las luces.'] }
    ]
  },
  {
    id: '5',
    title: 'Examen de Conocimientos Teóricos #5',
    questions: [
      { q: '¿Cuál es la vigencia general de una licencia de conducir particular en Panamá?', options: ['a) 2 años.', 'b) 4 años.', 'c) 10 años.', 'd) 5 años.'] },
      { q: 'Conducir con la licencia vencida conlleva:', options: ['a) Solo una advertencia.', 'b) Multa y retención del vehículo.', 'c) No pasa nada.', 'd) Cárcel de 24 horas.'] },
      { q: '¿Qué cantidad de puntos acumulados en el historial acarrea la suspensión de la licencia?', options: ['a) 10 puntos.', 'b) 35 puntos.', 'c) 15 puntos.', 'd) 50 puntos.'] },
      { q: 'El seguro de daños a terceros es:', options: ['a) Opcional.', 'b) Obligatorio para circular.', 'c) Solo para autos nuevos.', 'd) Para viajes largos.'] },
      { q: 'La embriaguez comprobada se sanciona con:', options: ['a) Multa, retención de licencia y del vehículo.', 'b) Una charla de tránsito.', 'c) Trabajo comunitario.', 'd) Solo multa.'] },
      { q: '¿Quién es la autoridad máxima encargada de regular el tránsito en Panamá?', options: ['a) La Policía Nacional.', 'b) La ATTT.', 'c) El Ministerio de Gobierno.', 'd) Los Jueces de Paz.'] },
      { q: 'Fugarse después de un accidente de tránsito es:', options: ['a) Una falta menor.', 'b) Un agravante serio que conlleva sanciones severas.', 'c) Permitido si no hay heridos.', 'd) Normal.'] },
      { q: '¿Cuál es la sanción por hablar por celular mientras se conduce?', options: ['a) Multa económica.', 'b) Retiro de placa.', 'c) Suspensión de por vida.', 'd) No hay sanción.'] },
      { q: 'El "desacato" en el pago de boletas ocurre después de:', options: ['a) 24 horas.', 'b) 30 días calendario.', 'c) 1 año.', 'd) 15 días.'] },
      { q: '¿Es obligatorio portar el Registro Único de Propiedad Vehicular?', options: ['a) No, solo la copia.', 'b) Sí, es un documento obligatorio.', 'c) Solo para salir de la ciudad.', 'd) Depende del modelo del auto.'] }
    ]
  }
];
