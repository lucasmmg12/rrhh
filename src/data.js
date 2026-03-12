
export const orgData = {
  "id": "SOCIOS-ROOT",
  "role": "Socios",
  "name": "",
  "status": "occupied",
  "type": "owner",
  "hierarchy_level": 0,
  "relationship": "line",
  "children": [
    // =============================================
    // NIVEL 1 — DIRECCIÓN (3 figuras directas de Socios)
    // =============================================
    {
      "id": "{E418301F-F2AE-4A40-9C9E-6ED2CDDD8576}",
      "role": "Gerente Administrativo",
      "name": "",
      "status": "occupied",
      "type": "manager",
      "hierarchy_level": 1,
      "relationship": "line",
      "photoUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=256&q=80",
      "profile": "Gestión eficiente de recursos administrativos y financieros. Enfoque en optimización de procesos y reducción de costos.",
      "tasks": [
        "Supervisar áreas de compras, sistemas y mantenimiento.",
        "Gestionar el presupuesto administrativo.",
        "Coordinar auditorías internas."
      ],
      "children": [
        {
          "id": "{B51BBA16-C3D1-4D4D-A551-E0A7B64762A3}",
          "role": "Jefe de Tecnología y Sistemas",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{A1A1A1A1-2B2B-3C3C-4D4D-5E5E5E5E5E5E}",
              "role": "Auxiliares de IT",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{F2F2F2F2-3G3G-4H4H-5I5I-6J6J6J6J6J6J}",
              "role": "Administrador de Redes",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{K7K7K7K7-8L8L-9M9M-0N0N-1O1O1O1O1O1O}",
              "role": "Técnico en IT",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            }
          ]
        },
        {
          "id": "{E46843C8-EA47-4925-88BB-8E1E66E95FFA}",
          "role": "Jefe de Compras y Suministros",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{B1B1B1B1-2C2C-3D3D-4E4E-5F5F5F5F5F5F}",
              "role": "Auxiliar de Depósito",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{G2G2G2G2-3H3H-4I4I-5J5J-6K6K6K6K6K6K}",
              "role": "Auxiliar de Compras",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{L7L7L7L7-8M8M-9N9N-0O0O-1P1P1P1P1P1P}",
              "role": "DT Farmacia",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": [
                {
                  "id": "{Q1Q1Q1Q1-2R2R-3S3S-4T4T-5U5U5U5U5U5U}",
                  "role": "Idoneo en Farmacia",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                }
              ]
            }
          ]
        },
        {
          "id": "{MANT-JEFE-GENERAL-001}",
          "role": "Jefe de Mantenimiento",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{FFD44421-312E-425B-B07C-B1C09077E991}",
              "role": "Jefe de Mantenimiento Edilicio",
              "name": "",
              "status": "occupied",
              "type": "chief",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": [
                {
                  "id": "{MANT-AUX-EDILICIO-001}",
                  "role": "Auxiliares de Mantenimiento Edilicio",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                }
              ]
            },
            {
              "id": "{MANT-CALIBRACION-001}",
              "role": "Responsable de Calibración de instrumentos",
              "name": "",
              "status": "occupied",
              "type": "manager",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{D2041C68-9308-4818-8DAE-30FC9A2166E0}",
              "role": "Jefe de Mantenimiento de Equipos Médicos",
              "name": "",
              "status": "occupied",
              "type": "chief",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": [
                {
                  "id": "{MANT-AUX-EQUIPOS-001}",
                  "role": "Auxiliares de Mantenimiento de Equipos Médicos",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                }
              ]
            }
          ]
        },
        {
          "id": "{B1EE1655-D3B7-412B-ADA6-356FA7FB942F}",
          "role": "Personal de Tesorería y Pagos",
          "name": "",
          "status": "occupied",
          "type": "employee",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{C1D2E3F4-5678-90AB-CDEF-1234567890AB}",
              "role": "Auditor Externo",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{D2E3F4G5-6789-0123-4567-890ABCDEF123}",
              "role": "Tesorero",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{E3F4G5H6-7890-1234-5678-90ABCDEF1234}",
              "role": "Auxiliar de Tesorería y Pagos",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{F4G5H6I7-8901-2345-6789-0123456789AB}",
              "role": "Analista de Tesorerias y Pagos",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            }
          ]
        },
        {
          "id": "{59CB198B-D35B-4A05-8DC4-B176A8D1EE98}",
          "role": "Jefe de Administración",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{Z1Z1Z1Z1-2A2A-3B3B-4C4C-5D5D5D5D5D5D}",
              "role": "Auxiliar de Administración",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            }
          ]
        },
        {
          "id": "{F80E1E5E-F272-4E42-9517-9876EABEE84E}",
          "role": "Responsable de Convenios y Liquidaciones",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{A1B2C3D4-E5F6-7890-1234-56789ABCDEF0}",
          "role": "Responsable de Innovación y Desarrollo Tecnológico",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{NEW-UUID-FACTURACION-JEFE}",
          "role": "Jefe de Facturación",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{NEW-UUID-FACT-AMB}",
              "role": "Auxiliar de Facturación Ambulatorio",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{NEW-UUID-FACT-INT}",
              "role": "Auxiliar de Facturacion Internado",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            }
          ]
        },
        {
          "id": "{REC-JEFE-AMB-SFE-001}",
          "role": "Jefe de Recepciones Ambulatorias Sede Santa Fe",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{REC-COORD-RECEPCIONES-001}",
              "role": "Coordinador de Recepciones",
              "name": "",
              "status": "occupied",
              "type": "coordinator",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": [
                {
                  "id": "{REC-TELEFONISTA-SFE-001}",
                  "role": "Recepcionistas/Telefonista de Sfe",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                },
                {
                  "id": "{REC-AUX-HOTELERIA-001}",
                  "role": "Auxiliar de Hotelería",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                },
                {
                  "id": "{REC-CITOLOGIA-001}",
                  "role": "Citología",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": [
                    {
                      "id": "{REC-CITOLOGIA-RECEP-001}",
                      "role": "Recepcionista",
                      "name": "",
                      "status": "occupied",
                      "type": "employee",
                      "hierarchy_level": 6,
                      "relationship": "line",
                      "children": []
                    },
                    {
                      "id": "{REC-CITOLOGIA-TECNICA-001}",
                      "role": "Técnica",
                      "name": "",
                      "status": "occupied",
                      "type": "employee",
                      "hierarchy_level": 6,
                      "relationship": "line",
                      "children": []
                    }
                  ]
                },
                {
                  "id": "{REC-DXI-SF-001}",
                  "role": "DXI SF",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": [
                    {
                      "id": "{REC-DXI-RECEP-001}",
                      "role": "Recepcionistas",
                      "name": "",
                      "status": "occupied",
                      "type": "employee",
                      "hierarchy_level": 6,
                      "relationship": "line",
                      "children": []
                    },
                    {
                      "id": "{REC-DXI-TECNICAS-001}",
                      "role": "Técnicas de Radiología",
                      "name": "",
                      "status": "occupied",
                      "type": "employee",
                      "hierarchy_level": 6,
                      "relationship": "line",
                      "children": []
                    },
                    {
                      "id": "{REC-DXI-TRANSCRIPT-001}",
                      "role": "Transcriptoras",
                      "name": "",
                      "status": "occupied",
                      "type": "employee",
                      "hierarchy_level": 6,
                      "relationship": "line",
                      "children": []
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "{REC-JEFE-AMB-DXI-123}",
          "role": "Jefe de Recepción Ambulatorio de DXI Sede 1, 2 y 3",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{REC-DXI-SEDE2-001}",
              "role": "Recepcionistas sede 2",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{REC-DXI-FERTILIDAD-001}",
              "role": "Recepcionista Fertilidad",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{REC-DXI-SEDE3-001}",
              "role": "Recepcionista Sede 3",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{REC-DXI-RECEP-DXI-001}",
              "role": "Recepcionistas de DXI",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{REC-DXI-TRANSCRIPT-002}",
              "role": "Transcriptoras",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{REC-DXI-TECNICAS-002}",
              "role": "Técnicas Radiologas",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            }
          ]
        }
      ]
    },
    {
      "id": "{EBF5F6DA-1992-4870-B0A2-9712574ECA7A}",
      "role": "Asesor Corporativo",
      "name": "",
      "status": "occupied",
      "type": "manager",
      "hierarchy_level": 1,
      "relationship": "line",
      "profile": "Asesoramiento integral en estrategias corporativas y desarrollo organizacional.",
      "tasks": [
        "Analizar tendencias de mercado.",
        "Proponer mejoras en procesos organizacionales.",
        "Asesorar a la dirección en toma de decisiones clave."
      ],
      "children": [
        {
          "id": "{DB0FE99D-2B14-4910-8B5D-351C30764EF0}",
          "role": "Responsable de Asistencia Psicológica",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{6CBCB035-157C-4ED5-B6E7-A9D1D306E4C8}",
          "role": "Responsable de Fundación",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{5506A9CA-3709-406F-A5EF-139A5ADB89A6}",
          "role": "Responsable de Programas de Prevención",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        }
      ]
    },
    {
      "id": "{4BF0637D-E47D-44B6-B545-AD75365DF124}",
      "role": "Director Médico",
      "name": "",
      "status": "occupied",
      "type": "director",
      "hierarchy_level": 1,
      "relationship": "line",
      "children": [
        {
          "id": "{0B08A9A3-6A74-405C-856B-78BB76599B86}",
          "role": "Jefe Médico Diagnóstico por Imágenes",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{97E897BA-3FBF-404C-AFF2-F4C17FF95FB3}",
          "role": "Jefe Médico de UCI",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{833F4B66-B9E5-4C9C-83D2-D7083F012160}",
          "role": "Coordinador Médico de Guardia Pediátrica",
          "name": "",
          "status": "occupied",
          "type": "coordinator",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{0E1C0470-61F5-4C9D-9A27-1A0E36DF06B3}",
          "role": "Jefe Médico de Quirófano",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{87CF6CD6-71A4-480F-A9AC-75768B71F40E}",
          "role": "Coordinador Médico de Anestesia",
          "name": "",
          "status": "occupied",
          "type": "coordinator",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{DD5D7177-BAF4-425B-BB86-14B42A72E9D6}",
          "role": "Director Técnico Laboratorio",
          "name": "",
          "status": "occupied",
          "type": "director",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{B92BA988-0549-4F04-9CC1-DDF620A4C153}",
          "role": "Jefe Médico de Fertilidad",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{EC852F31-9196-4BF5-B881-C67E15F3C978}",
          "role": "Coordinador Médico de Cirugía Pediátrica",
          "name": "",
          "status": "occupied",
          "type": "coordinator",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{8B77F9F9-44CB-459E-A2B0-955F3BC3D531}",
          "role": "Jefe Médico de UTIN",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{53330E15-D146-4B44-8DA7-30C183F25683}",
          "role": "Jefe Médico de UTIP",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{8A6F3C08-8483-4AAB-9C4C-3E574F6F92BF}",
          "role": "Director Técnico Hemoterapia",
          "name": "",
          "status": "occupied",
          "type": "director",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{E563A96B-471F-4F11-9F20-439423AE598D}",
          "role": "Farmacéutico Director Técnico",
          "name": "",
          "status": "occupied",
          "type": "director",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{2FF6833C-1FB2-44F2-856B-1BF474ED616A}",
          "role": "Coordinador Médico de Cardiología",
          "name": "",
          "status": "occupied",
          "type": "coordinator",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{58925E88-7EBC-4A71-AC6A-D674CB58CAB4}",
          "role": "Coordinador Médico de Guardia de Ginecología",
          "name": "",
          "status": "occupied",
          "type": "coordinator",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{CC8B589A-DD6E-42B5-8D11-BF5ECEB31069}",
          "role": "Coordinador Médico de Hemodinamia",
          "name": "",
          "status": "occupied",
          "type": "coordinator",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{89D50B1C-0137-407F-BEC1-7954955BA98B}",
          "role": "Coordinador Médico de Traumatología",
          "name": "",
          "status": "occupied",
          "type": "coordinator",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{4EB9E7CD-DB0B-476E-B759-062B6551BE45}",
          "role": "Jefe de Alimentación y Nutrición",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{NUT-COORD-TARDE-001}",
              "role": "Coordinadora Nutrición y alimentación turno tarde",
              "name": "",
              "status": "occupied",
              "type": "coordinator",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            },
            {
              "id": "{NUT-SUPER-COCINA-001}",
              "role": "Supervisora de cocina",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": [
                {
                  "id": "{NUT-AUX-COCINA-001}",
                  "role": "Auxiliar de Cocina",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                }
              ]
            }
          ]
        },
        {
          "id": "{C71067AA-0AFD-49D1-A0A1-DEF2A8385045}",
          "role": "Jefe Médico de Internados",
          "name": "",
          "status": "occupied",
          "type": "chief",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{INT-JEFA-ENFERMERIA-001}",
              "role": "Jefa de Enfermería",
              "name": "",
              "status": "occupied",
              "type": "chief",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": [
                {
                  "id": "{INT-ENFERMERAS-001}",
                  "role": "Enfermeras",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                },
                {
                  "id": "{INT-CAMILLEROS-001}",
                  "role": "Camilleros",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                }
              ]
            },
            {
              "id": "{INT-COORD-GUARDIAS-001}",
              "role": "Coordinador de Guardias Médicas y Ginecológicas",
              "name": "",
              "status": "occupied",
              "type": "coordinator",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": [
                {
                  "id": "{INT-MEDICOS-GUARDIA-001}",
                  "role": "Médicos de Guardia",
                  "name": "",
                  "status": "occupied",
                  "type": "employee",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": []
                }
              ]
            },
            {
              "id": "{INT-COORD-RESIDENCIA-001}",
              "role": "Coordinador de Residencia",
              "name": "",
              "status": "occupied",
              "type": "coordinator",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": [
                {
                  "id": "{INT-JEFE-RESIDENCIA-001}",
                  "role": "Jefe de Residencia",
                  "name": "",
                  "status": "occupied",
                  "type": "chief",
                  "hierarchy_level": 5,
                  "relationship": "line",
                  "children": [
                    {
                      "id": "{INT-INSTRUCTOR-GINECO-001}",
                      "role": "Instructor Ginecología",
                      "name": "",
                      "status": "occupied",
                      "type": "employee",
                      "hierarchy_level": 6,
                      "relationship": "line",
                      "children": []
                    },
                    {
                      "id": "{INT-INSTRUCTOR-OBSTETR-001}",
                      "role": "Instructor de Obstetricia",
                      "name": "",
                      "status": "occupied",
                      "type": "employee",
                      "hierarchy_level": 6,
                      "relationship": "line",
                      "children": [
                        {
                          "id": "{INT-RESIDENTES-001}",
                          "role": "Residentes",
                          "name": "",
                          "status": "occupied",
                          "type": "employee",
                          "hierarchy_level": 7,
                          "relationship": "line",
                          "children": []
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "{544B5FD2-571F-490D-B895-87680DDADC1E}",
          "role": "Coordinador Médico de Guardia Clínica",
          "name": "",
          "status": "occupied",
          "type": "coordinator",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{CCD7AE4A-601B-47C5-8A23-63AF38C46419}",
          "role": "Servicios de Anatomía Patológica",
          "name": "",
          "status": "occupied",
          "type": "employee",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        }
      ]
    },

    // =============================================
    // NIVEL 2 — STAFF / SOPORTE (líneas punteadas)
    // Dependen de la Dirección (Socios), no de una gerencia
    // =============================================
    {
      "id": "{A7F6CCB6-BCE1-401D-948F-B8665A6BC9D1}",
      "role": "Jefe de RRHH",
      "name": "",
      "status": "occupied",
      "type": "chief",
      "hierarchy_level": 2,
      "relationship": "staff",
      "children": [
        {
          "id": "{FE3E0A14-3382-4F22-ABAF-143017D193E3}",
          "role": "Responsable de Personal",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": [
            {
              "id": "{5A2B3C4D-1E2F-3A4B-5C6D-7E8F9A0B1C2D}",
              "role": "Seguridad Patrimonial",
              "name": "",
              "status": "occupied",
              "type": "employee",
              "hierarchy_level": 4,
              "relationship": "line",
              "children": []
            }
          ]
        },
        {
          "id": "{3A0E7964-9D1B-45B1-A5CD-95454FCE8C65}",
          "role": "Auxiliar de RRHH",
          "name": "",
          "status": "occupied",
          "type": "employee",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{1F0FE6C1-A00A-4FFB-A6E1-CA1A30249BBA}",
          "role": "Responsable de Capacitación y Selección",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        }
      ]
    },
    {
      "id": "{C469F50C-63A3-42B0-A299-BDD8CE167C26}",
      "role": "Jefe Dpto. Calidad y Seguridad de Pacientes",
      "name": "",
      "status": "occupied",
      "type": "chief",
      "hierarchy_level": 2,
      "relationship": "staff",
      "children": [
        {
          "id": "{5808DBAA-C62D-4876-8E5C-EB40FA83F785}",
          "role": "Responsable de SGC",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{20DC9360-BF6F-4C19-AF95-84482F285BB8}",
          "role": "Responsable de Higiene & Seguridad y Gestión Documentada",
          "name": "",
          "status": "occupied",
          "type": "manager",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        },
        {
          "id": "{C87F60D6-2E3F-42A8-98F5-8E6ADD040318}",
          "role": "Comité de Infectología y Vigilancia de Medicamentos",
          "name": "",
          "status": "occupied",
          "type": "employee",
          "hierarchy_level": 3,
          "relationship": "line",
          "children": []
        }
      ]
    },
    {
      "id": "{9472F3B2-9B62-4AFB-B490-8D970ED9147E}",
      "role": "Comité de Docencia e Investigación",
      "name": "",
      "status": "occupied",
      "type": "committee",
      "hierarchy_level": 2,
      "relationship": "staff",
      "children": []
    },
    {
      "id": "{63A991F0-DD62-4597-88FF-97CA28996C22}",
      "role": "Asesor Legal",
      "name": "",
      "status": "occupied",
      "type": "advisor",
      "hierarchy_level": 2,
      "relationship": "staff",
      "children": []
    },
    {
      "id": "{733F67FD-CCD4-417E-8122-4FFE922680B8}",
      "role": "Vocero Institucional",
      "name": "",
      "status": "occupied",
      "type": "advisor",
      "hierarchy_level": 2,
      "relationship": "staff",
      "children": []
    }
  ]
};
