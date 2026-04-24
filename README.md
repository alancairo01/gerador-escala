# Gerador de Escala Automática 

Sistema em JavaScript + Node.js para geração e edição de escala.

## Como rodar

```powershell
npm start
```

Depois abra:

```text
http://localhost:3000
```

## 

- Personalização de cores por item da tabela.
- Cor personalizada por célula da escala.
- Campo `Quantidade de domingos` com opções `0º`, `1º`, `2º` e `3º`.
- Impressão/PDF otimizado em A4 paisagem.
- Exportação JPEG e WhatsApp JPEG.
- Seleção múltipla de dias.
- Alertas de descanso obrigatório.
- Salvamento automático em `data/state.json`.


## 

- Cada colaborador tem direito a pelo menos 1 FOLGA por semana.
- A geração automática evita escalar o colaborador por 7 dias seguidos dentro da mesma semana.
- Se uma alteração manual remover a folga semanal, o sistema mostra um alerta vermelho no canto superior da tela.


Atualizações v8:
- Selecionar tudo e edição em lote.
- Alteração livre dos horários com validação posterior.
- Validação de cobertura por horário, descanso mínimo de 11h30, folga semanal e 3 domingos consecutivos.
- Campo de domingos somente para técnicos, com progressão automática 0º/1º/2º/3º.


Atualizações v9:
- Alerta vermelho ficou menor e no canto inferior, sem atrapalhar a tabela.
- Horários alterados recebem cor automática obrigatória:
  - 06:00 às 12:00: #d395a6
  - 12:00 às 18:00: #76bb68
  - 18:00 às 00:00: #d9ef6a
  - 00:00 às 06:00: #ff000d
- Adicionado parâmetro de geração Sequencial/Aleatória.
- A geração aleatória tenta obedecer cobertura, descanso mínimo, folga semanal e domingos consecutivos.


Atualizações v10:
- Modo padrão agora é Manual vazio: a tabela nasce sem horários.
- Os alertas de regras só aparecem ao clicar em Validar regras.
- A edição de várias células foi corrigida: selecione os campos e use Editar selecionados, ou clique em uma célula já selecionada.
- Alterações nas células não regeneram a escala automaticamente, então os horários preenchidos manualmente não são perdidos.


Atualizações v11:
- Adicionado campo "Validar cobertura".
- Por padrão, a cobertura é validada apenas para Técnico de Sistemas Audio Visuais.
- Assim, o sistema não cobra mais turno extra do Controlador de Operações, como 06:00–14:20, a menos que você escolha "Todos os cargos".
- Você também pode desligar a validação de cobertura e manter apenas as validações de descanso, folga semanal e domingos consecutivos.


Atualizações v12:
- Ao alterar a quantidade de domingo de uma semana, as semanas seguintes do mesmo técnico são atualizadas automaticamente.
  Exemplo: se a primeira semana ficar como 2º domingo, a próxima fica 3º domingo.
- Aos domingos, o turno 00:00–06:00 dos técnicos não é mais obrigatório na validação de cobertura.
- Na geração automática, o sistema também não força técnico no turno 00:00–06:00 aos domingos.
