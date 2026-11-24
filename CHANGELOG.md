# Historial de versiones

Formato: [versionado semántico](https://semver.org/lang/es/). MAYOR.MENOR.PARCHE
— MAYOR cambia datos o rompe algo, MENOR agrega funciones, PARCHE corrige errores.

## [1.0.0] - 2026-11-24

Primera versión como app de Android y app web para iPhone.

- Fichas de perros: foto, sexo, raza, nacimiento y edad, registro FCM, microchip, color y notas.
- Agenda con el anillo del ciclo de cada hembra y lista de próximos eventos.
- Celos: intervalo promedio calculado con los celos registrados (6 meses si hay menos de dos).
- Pruebas de progesterona (ng/mL o nmol/L) con lectura de etapa, pico de LH, ovulación y fechas de cruza.
- Cruzas y partos: fecha probable de parto (desde la ovulación si hay progesterona, si no desde la monta) e hitos de la gestación.
- Recordatorio de la ventana para tramitar el pedigrí FCM de la camada.
- Árbol genealógico de 3 generaciones; los perros vinculados copian sus ancestros.
- Notificaciones locales en Android (9:00 del día del evento y la noche anterior a los más importantes).
- Exportar eventos a calendario (.ics).
- Respaldo: exportar e importar todos los datos en un archivo JSON.
