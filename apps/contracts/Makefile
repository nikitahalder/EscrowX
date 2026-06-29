# EscrowX Soroban contract — build / test / deploy
#
# Usage:
#   make build       # compile the optimized WASM
#   make test        # run the unit-test suite
#   make deploy      # deploy to testnet (needs SOURCE + NETWORK)
#
# Override on the command line, e.g.:
#   make deploy SOURCE=my-key NETWORK=testnet

TARGET        := wasm32-unknown-unknown
PROFILE       := release
WASM          := target/$(TARGET)/$(PROFILE)/escrowx_contract.wasm
SOURCE        ?= deployer
NETWORK       ?= testnet

.PHONY: all build test fmt clippy clean optimize deploy

all: build

build:
	cargo build --target $(TARGET) --release

test:
	cargo test --features testutils

fmt:
	cargo fmt --all

clippy:
	cargo clippy --features testutils -- -D warnings

clean:
	cargo clean

# Strip and shrink the WASM with the Stellar CLI (requires `stellar` >= 22).
optimize: build
	stellar contract optimize --wasm $(WASM)

# Deploy the freshly-built WASM to the chosen network. Prints the contract ID.
deploy: build
	stellar contract deploy \
		--wasm $(WASM) \
		--source $(SOURCE) \
		--network $(NETWORK)
