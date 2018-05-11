// Flow control components for lab.js
import { mean, isFunction } from 'lodash'
import { Component, status } from './core'

// Helper function to handle nested components
export const prepareNested = function(nested, parent) {
  // Setup parent links on nested components
  nested.forEach(c => (c.parent = parent))

  // Set ids on nested components
  nested.forEach((c, i) => {
    // For each child, use this component's id
    // and append a counter
    if (parent.options.id == null) {
      c.options.id = String(i)
    } else {
      c.options.id = [parent.options.id, i].join('_')
    }
  })

  // Trigger prepare on all nested components
  return Promise.all(
    nested.map(c => c.prepare(false)), // indicate automated call
  )
}

// A sequence combines an array of other
// components and runs them sequentially
export class Sequence extends Component {
  constructor(options={}) {
    super({
      // Define an array of nested components
      // to iterate over
      content: [],
      // Shuffle items, if so desired
      shuffle: false,
      ...options,
    })

    // Set default values for current component and index
    this.internals.currentComponent = null
    this.internals.currentPosition = null
  }

  async onPrepare() {
    // Shuffle content, if requested
    if (this.options.shuffle) {
      this.options.content = this.random.shuffle(this.options.content)
    }

    // Define an iterator over the content
    this.internals.iterator = this.options.content.entries()
    this.internals.stepper = this.step.bind(this)

    // Prepare nested items
    await prepareNested(this.options.content, this)
  }

  async onRun(frameTimeStamp) {
    // Make the first step
    return this.step(frameTimeStamp)
  }

  onEnd() {
    // End prematurely, if necessary
    // (check whether there is an active component,
    // and if so, whether it has finished)
    if (this.internals.currentComponent &&
      this.internals.currentComponent.status !== status.done) {
      this.internals.currentComponent.off('after:end', this.internals.stepper)
      this.internals.currentComponent.end('abort by sequence')
    }
  }

  async step(frameTimeStamp, frameSynced) {
    if (this.status === status.done) {
      throw new Error('Sequence ended, can\'t take any more steps')
    }

    // Move through the content
    const next = this.internals.iterator.next()
    if (next.done) {
      return this.end('completion', frameTimeStamp)
    } else {
      [this.internals.currentPosition, this.internals.currentComponent] =
        next.value
      this.internals.currentComponent.on('after:end', this.internals.stepper)
      return this.internals.currentComponent.run(frameTimeStamp, frameSynced)
    }
  }

  get progress() {
    // If the sequence has ended,
    // report it as completed
    // (even if content was skipped)
    return this.status === status.done ? 1 : mean(
      this.options.content.map(c => c.progress),
    )
  }
}

Sequence.metadata = {
  module: ['flow'],
  nestedComponents: ['content'],
  parsableOptions: {
    shuffle: { type: 'boolean' },
  },
}

// A loop functions exactly like a sequence,
// except that the components in the loop are
// generated upon initialization from a
// factory function and a data collection.
// Technically, the content is generated by
// mapping the data onto the factory function.
export class Loop extends Sequence {
  constructor(options={}) {
    super({
      template: null,
      templateParameters: [],
      sample: {
        n: undefined,
        replace: false,
      },
      ...options,
    })
  }

  onPrepare() {
    // Sample parameters to make room for repetitions and subsampling
    const templateParameters = this.options.sample.n
      ? this.random.sample(
          this.options.templateParameters,
          this.options.sample.n,
          this.options.sample.replace,
        )
      : this.options.templateParameters

    // Generate the content by cloning the template,
    // replacing the parameters each time, or by
    // mapping the parameters onto a function that
    // returns a component.
    if (this.options.template instanceof Component) {
      this.options.content = templateParameters.map((p) => {
        const c = this.options.template.clone()
        // Extend parameters
        c.options.parameters = {
          ...c.options.parameters,
          ...p,
        }
        return c
      })
    } else if (isFunction(this.options.template)) {
      this.options.content = templateParameters.map(
        (p, i) => this.options.template(p, i, this),
      )
    } else {
      console.warn('Missing or invalid template in loop, no content generated')
    }

    return super.onPrepare()
  }
}

Loop.metadata = {
  module: ['flow'],
  nestedComponents: ['template'],
  parsableOptions: {
    sample: {
      type: 'object',
      content: {
        n: { type: 'number' },
        replace: { type: 'boolean' },
      },
    },
  },
}

// A parallel component executes multiple
// other components simultaneously
export class Parallel extends Component {
  constructor(options={}) {
    super({
      // The content, in this case,
      // consists of an array of components
      // that are run in parallel.
      content: [],
      mode: 'race',
      ...options,
    })
  }

  onPrepare() {
    prepareNested(this.options.content, this)
  }

  // The run method is overwritten at this point,
  // because the original promise is swapped for a
  // version that runs all nested items in parallel
  onRun(frameTimeStamp) {
    // End this component when all nested components,
    // or a single component, have ended
    Promise[this.options.mode](
      this.options.content.map(c => c.waitFor('end')),
    ).then(() => this.end())

    // Run all nested components simultaneously
    return Promise.all(
      this.options.content.map(c => c.run(frameTimeStamp)),
    )
  }

  onEnd() {
    // Cancel remaining running nested components
    this.options.content.forEach((c) => {
      if (c.status < status.done) {
        c.end('abort by parallel')
      }
    })
  }

  get progress() {
    // If the parallel has ended,
    // report it as completed
    // (even if content was skipped),
    return this.status === status.done ? 1 : mean(
      this.options.content.map(c => c.progress),
    )
  }
}

Parallel.metadata = {
  module: ['flow'],
  nestedComponents: ['content'],
  parsableOptions: {
    mode: {},
  },
}
