// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const requestBin = require('./requestbin')
const fs = require('fs')

const { DialogSet, WaterfallDialog, ChoicePrompt, DialogTurnStatus } =
    require('botbuilder-dialogs')

// Define identifiers for our state property accessors.
const DIALOG_STATE_ACCESSOR = 'dialogStateAccessor'
const QUESTION_ACCESSOR = 'questionAccessor'

// Define identifiers for our dialogs and prompts.
const QUESTION_DIALOG = 'questionDialog'
const QUESTION_PROMPT = 'questionPrompt'

// Read the json file containing the questins and parse its json to get a javascript object
let questions = JSON.parse(fs.readFileSync('questions.json'))

class DialogPromptBot {
  /**
     *
     * @param {ConversationState} conversation state object
     */
  constructor (conversationState) {
    // Creates our state accessor properties.
    this.dialogStateAccessor = conversationState.createProperty(DIALOG_STATE_ACCESSOR)
    this.questionAccessor = conversationState.createProperty(QUESTION_ACCESSOR)
    this.conversationState = conversationState

    // Create the dialog set and add the prompts, including custom validation.
    this.dialogSet = new DialogSet(this.dialogStateAccessor)
    this.dialogSet.add(new ChoicePrompt(QUESTION_PROMPT, this.rangeValidator))

    this.dialogArray = []

    // Define the steps of the waterfall dialog.
    questions.forEach(element => {
      this.dialogArray.push(this.promptForQuestions.bind(this, element))
    })
    this.dialogArray.push(this.acknowledgeRecieval.bind(this))

    // Add the waterfall dialog to the set
    this.dialogSet.add(new WaterfallDialog(QUESTION_DIALOG, this.dialogArray))
  }

  /**
     *
     * @param {TurnContext} on turn context object.
     */
  async onTurn (turnContext) {
    // Get the current question info from state.
    const question = await this.questionAccessor.get(turnContext, null)

    // Generate a dialog context for our dialog set.
    const dc = await this.dialogSet.createContext(turnContext)

    if (!dc.activeDialog) {
      // If there is no active dialog, check whether we have a question yet.
      if (!question) {
        // If not, start the dialog.
        await dc.beginDialog(QUESTION_DIALOG)
      } else {
        // Otherwise, send a status message.
        await turnContext.sendActivity(
          'You have completed all question, See ya arround')
      }
    } else {
      // Continue the dialog.
      const dialogTurnResult = await dc.continueDialog()

      // If the dialog completed this turn, record the question info.
      if (dialogTurnResult.status === DialogTurnStatus.complete) {
        await this.questionAccessor.set(
          turnContext,
          dialogTurnResult.result)

        // Send a confirmation message to the user.
        await turnContext.sendActivity(
          `Your answerd ${dialogTurnResult.result.answers.length} questions`)
      }
      // Log the details of the question the bin URL

      if (dialogTurnResult.result !== undefined) {
        requestBin(`Answerd where given for ${dialogTurnResult.result.answers.length} questions`, function (err, res, body) {
          if (err) {
            return console.log(err)
          }
          // console.log(body)
        })
      }
    }

    // Save the updated dialog state into the conversation state.
    await this.conversationState.saveChanges(turnContext, false)
  }

  async promptForQuestions (t, stepContext) {
    // Record the party size information in the current dialog state.
    if (stepContext.values.answers === undefined && stepContext.result) {
      stepContext.values.answers = [stepContext.result]
    } else if (stepContext.result) {
      stepContext.values.answers.push(stepContext.result)
    }

    // Prompt for Answer to question.
    return stepContext.prompt(QUESTION_PROMPT, {
      prompt: t.text,
      retryPrompt: `Sorry, please choose a ${t.title} from the list.`,
      choices: t.question_list
    })
  }

  async acknowledgeRecieval (stepContext) {
    // Retrieve the question date.

    stepContext.values.answers.push(stepContext.result)

    // Send an acknowledgement to the user.
    await stepContext.context.sendActivity(
      'Thank you for taking the time to carry out the survey')

    // Return the collected information to the parent context.
    return stepContext.endDialog({
      answers: stepContext.values.answers
    })
  }

  async rangeValidator (promptContext) {
    // Check whether the input could be recognized as an integer.

    if (!promptContext.recognized.succeeded) {
      await promptContext.context.sendActivity(
        "I'm sorry, I do not understand. Please enter the number assigned to your choice \n '1, 2 or 3'.")
      return false
    }

    // Check whether the party size is appropriate.
    return true
  }
}

module.exports.DialogPromptBot = DialogPromptBot
