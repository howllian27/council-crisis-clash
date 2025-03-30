import asyncio
import uuid
from datetime import datetime, timedelta
from game.state import GameState, Player, ResourceType, GamePhase

async def simulate_game():
    # Create a test session
    session_id = str(uuid.uuid4())
    host_id = str(uuid.uuid4())
    
    # Create game state
    game = await GameState.create(session_id, host_id)
    
    # Create 4 players
    players = [
        Player(
            id=str(uuid.uuid4()),
            name=f"Player {i+1}",
            role=f"Council Member {i+1}",
            secret_incentive=f"Secret incentive {i+1}"
        ) for i in range(4)
    ]
    
    # Add players to game
    for player in players:
        await game.add_player(player)
    
    # Simulate 10 rounds
    for round_num in range(1, 11):
        print(f"\n=== Round {round_num} ===")
        
        # Set round start time
        game.round_start_time = datetime.now().timestamp()
        game.current_round = round_num
        game.phase = GamePhase.SCENARIO
        await game.save()
        
        # Simulate scenario presentation
        print(f"Presenting scenario for round {round_num}")
        game.current_scenario = f"Test scenario {round_num}"
        game.current_options = [
            f"Option A for round {round_num}",
            f"Option B for round {round_num}",
            f"Option C for round {round_num}"
        ]
        await game.save()
        
        # Move to voting phase
        game.phase = GamePhase.VOTING
        await game.save()
        
        # Simulate votes
        for player in players:
            if player.is_active:
                vote = f"Option {chr(65 + round_num % 3)}"  # Rotate through options
                await game.record_vote(player.id, vote)
                print(f"{player.name} voted for {vote}")
        
        # Move to results phase
        game.phase = GamePhase.RESULTS
        game.round_end_time = datetime.now().timestamp()
        
        # Simulate resource changes
        resource_changes = {
            ResourceType.TECH: -5 + round_num % 3,
            ResourceType.MANPOWER: -3 + round_num % 2,
            ResourceType.ECONOMY: -4 + round_num % 3,
            ResourceType.HAPPINESS: -2 + round_num % 2,
            ResourceType.TRUST: -3 + round_num % 2
        }
        await game.update_resources(resource_changes)
        
        # Simulate elimination every 3 rounds
        if round_num % 3 == 0:
            game.phase = GamePhase.ELIMINATION
            eliminated_player = players[round_num % 4]  # Rotate through players
            await game.remove_player(eliminated_player.id)
            print(f"{eliminated_player.name} was eliminated")
        
        await game.save()
        
        # Check if game should end
        if await game.check_game_end():
            print("Game ended!")
            break
        
        # Wait a bit between rounds
        await asyncio.sleep(1)
    
    print("\nGame simulation completed!")

if __name__ == "__main__":
    asyncio.run(simulate_game()) 