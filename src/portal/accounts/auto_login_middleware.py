from django.contrib.auth.models import User
from django.contrib.auth import login
from django.http import HttpResponse
import random
import string


class AutoCreateUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check if the user is authenticated
        if request.user.is_authenticated:
            return HttpResponse(
                "Viewing multiple streams at the same time is not permitted, sorry."
            )
        else:
            # Automatically create a new user
            username = "".join(
                random.choices(string.ascii_lowercase + string.digits, k=8)
            )
            password = User.objects.make_random_password()
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(password)
                user.save()
                # Log the user in
                user.backend = "django.contrib.auth.backends.ModelBackend"  # Specify the authentication backend
                login(request, user)

        response = self.get_response(request)
        return response
