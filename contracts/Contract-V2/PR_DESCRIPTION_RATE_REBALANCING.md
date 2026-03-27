# PR Description: Issue #377 - Push-Pull Rate Re-balancing

## Summary
Allow a sender to propose a new flow rate (e.g., increasing a salary stream) and the receiver to accept it, ensuring both parties agree to the new financial terms.

## Motivation
In real-world payment streaming scenarios, the flow rate may need to be adjusted:
- Salary increases or bonuses
- Contract renegotiations
- Adjusting for inflation or exchange rate changes

This feature implements a secure two-party agreement mechanism where:
1. The sender proposes a new rate
2. The receiver reviews and accepts the proposal
3. The stream is automatically recalculated based on remaining balance

## Technical Implementation

### New Types

#### PendingRateUpdate
```rust
pub struct PendingRateUpdate {
    pub new_rate: i128,           // New proposed rate (amount per second)
    pub proposed_at: u64,         // Unix timestamp when proposed
    pub proposed_by: Address,     // Always the sender
    pub original_end_time: u64,   // Original end time before change
    pub original_total_amount: i128, // Original total amount
}
```

### API Changes

#### New Public Functions
| Function | Description | Access |
|----------|-------------|--------|
| `propose_rate(stream_id, new_rate)` | Sender proposes new rate | Sender only |
| `accept_rate(stream_id)` | Receiver accepts proposal | Receiver only |
| `cancel_rate_proposal(stream_id, caller)` | Cancel pending proposal | Sender or Receiver |
| `get_pending_rate_update(stream_id)` | Get pending update if exists | Anyone |

### Rate Calculation Logic

When a rate change is proposed:
1. Calculate remaining balance at current time
2. Calculate new end time: `new_end_time = now + (remaining_balance / new_rate)`
3. Store pending update with 7-day TTL

When a rate change is accepted:
1. Validate the proposal hasn't expired
2. Verify caller is the receiver
3. Apply the new end_time to the stream
4. Clear the pending update

### Storage
- `PendingRateUpdate(stream_id)` - Stores the pending update
- `PendingRateUpdateExpiry(stream_id)` - Tracks when proposal was created

### TTL (Time-To-Live)
- Proposals expire after **7 days (604,800 seconds)**
- Expired proposals are automatically cleaned up
- Either party can cancel before acceptance

## Error Handling
| Error | Code | Description |
|-------|------|-------------|
| `NoPendingUpdate` | 57 | No proposal exists for this stream |
| `PendingUpdateExists` | 58 | A proposal already exists |
| `UpdateExpired` | 59 | Proposal has exceeded 7-day TTL |
| `InvalidNewRate` | 60 | Rate must be greater than 0 |
| `InsufficientBalanceForNewRate` | 61 | Not enough balance for new rate |
| `NotReceiver` | 62 | Only receiver can accept proposals |
| `StreamNotActive` | 63 | Stream is cancelled or completed |

## Files Changed
```
contracts/Contract-V2/src/contracterror.rs  - Added 7 error variants
contracts/Contract-V2/src/types.rs           - Added PendingRateUpdate, events
contracts/Contract-V2/src/storage.rs         - Added storage keys, helper functions
contracts/Contract-V2/src/lib.rs            - Added propose_rate, accept_rate, etc.
contracts/Contract-V2/src/test.rs           - Added 7 comprehensive tests
```

## Testing
- `test_propose_rate_creates_pending_update` - Basic proposal creation
- `test_propose_rate_fails_for_zero_rate` - Rate validation
- `test_propose_rate_fails_for_non_sender` - Authorization check
- `test_accept_rate_updates_stream` - Rate acceptance
- `test_cancel_rate_proposal_removes_pending` - Proposal cancellation
- `test_get_pending_rate_update_returns_none_when_no_proposal` - Query empty state
- `test_propose_rate_fails_for_nonexistent_stream` - Stream validation

## Usage Examples

### Propose a Rate Increase
```rust
// Current: 100 tokens over 100 seconds = 1 token/sec
// After 50 seconds: ~50 tokens remaining
// Propose: 2 tokens/sec → new end time: now + 25 seconds

let pending = contract.propose_rate(
    stream_id,    // u64
    2_000_000,    // new_rate: 2 tokens per second
);
```

### Accept the Rate Change
```rust
// Only receiver can accept
let new_end_time = contract.accept_rate(stream_id);
```

### Cancel a Proposal
```rust
// Either party can cancel
contract.cancel_rate_proposal(stream_id, caller);
```

## Backward Compatibility
All existing functions remain unchanged. New functions are additive.

## Label
[Contract-V2] Logic Hard
