
parking lot:

- core api
    - assets
- AVIF, how we cant control architecutre or apis
- breaking changes of the api -> how are we rolling out

-----

### Widget Change

Current:

LGraphWidget
    constructor()
    serialize()
    callback()
    value

static vs. instance?

Changes:

1. Change to serialize on access
    - edge cases (perf issues, compat issues)
        - widgets that upload files: 3d
        - widgets with heavy perf cost: webcam
        - widgets that rely on specific, non-hot-path, serialization steps: webcam
        - widgets whose post-serialize value depends on life cycle steps that they expect have happened


### Output System Change

- how to design
- force declaration
    - declare outputs in the node schema
    - explicitly add the output types to the schema
        - then on each nodle, explicitly decleare the output slots (io output type)
        - see the example from ComfyUI code's SaveVideo -> put in schema like this for how its done for that node's inputs
        - 



## Test Framework

First, identify all classes of behaviors that we know are common in the ecosystem:

- prototypes
    - patching
    - constructor prototype patching
    - shadowing from the prototype scope to affect constructtion
- monkey patching
    - setters
    - getters
    - methods
